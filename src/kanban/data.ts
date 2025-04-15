// Data handling for the Kanban board
import { Bookmark, Column } from "../models/bookmark";
import { Workspace } from "../models/workspace";
import storageService from "../utils/storage";
import analyticsService from "../utils/analytics";
import { KanbanState } from "./types";

// Initial state
export const initialState: KanbanState = {
  activeWorkspaceId: "",
  workspaces: {},
  columns: {},
  bookmarks: {},
};

/**
 * Load all data from storage
 * @returns Promise that resolves to the loaded state
 */
export async function loadData(): Promise<KanbanState> {
  try {
    // Get workspace settings
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId = workspaceSettings?.lastVisitedWorkspaceId || "";

    // Get workspaces with error handling
    const workspaces = (await storageService.getWorkspaces()) || {};

    // Get columns with error handling
    const columns = (await storageService.getColumns()) || {};

    // Get bookmarks with error handling
    const bookmarks = (await storageService.getBookmarks()) || {};

    return {
      activeWorkspaceId,
      workspaces,
      columns,
      bookmarks,
    };
  } catch (error) {
    console.error("Error loading data:", error);
    // Return initial state as fallback
    return {
      activeWorkspaceId: "",
      workspaces: {},
      columns: {},
      bookmarks: {},
    };
  }
}

/**
 * Switch to a different workspace
 * @param workspaceId The ID of the workspace to switch to
 */
export async function switchWorkspace(workspaceId: string): Promise<void> {
  await storageService.updateWorkspaceSettings({
    lastVisitedWorkspaceId: workspaceId,
  });
}

/**
 * Save a workspace
 * @param workspace The workspace to save
 */
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  await storageService.saveWorkspace(workspace);
}

/**
 * Delete a workspace and all its columns and bookmarks
 * @param workspaceId The ID of the workspace to delete
 */
export async function deleteWorkspace(workspaceId: string): Promise<string> {
  const workspaces = await storageService.getWorkspaces();
  const columns = await storageService.getColumns();

  // Delete all columns in the workspace
  const workspaceColumns = Object.values(columns).filter(
    (column) => column.workspaceId === workspaceId
  );
  for (const column of workspaceColumns) {
    // Delete all bookmarks in the column
    for (const bookmarkId of column.bookmarkIds) {
      await storageService.deleteBookmark(bookmarkId);
    }

    // Delete the column
    await storageService.deleteColumn(column.id);
  }

  // Delete the workspace
  await storageService.deleteWorkspace(workspaceId);

  // Switch to another workspace
  const remainingWorkspaces = Object.values(workspaces).filter(
    (w) => w.id !== workspaceId
  );
  const newActiveWorkspaceId = remainingWorkspaces[0]?.id || "default";
  await switchWorkspace(newActiveWorkspaceId);

  return newActiveWorkspaceId;
}

/**
 * Save a column
 * @param column The column to save
 */
export async function saveColumn(column: Column): Promise<void> {
  await storageService.saveColumn(column);
}

/**
 * Delete a column and all its bookmarks
 * @param columnId The ID of the column to delete
 * @param workspaceId The ID of the workspace containing the column
 */
export async function deleteColumn(
  columnId: string,
  workspaceId: string
): Promise<void> {
  const columns = await storageService.getColumns();
  const column = columns[columnId];

  // Delete all bookmarks in the column
  for (const bookmarkId of column.bookmarkIds) {
    await storageService.deleteBookmark(bookmarkId);
  }

  // Delete the column
  await storageService.deleteColumn(columnId);

  // Update workspace columnIds
  const workspace = await storageService.getWorkspace(workspaceId);
  if (workspace) {
    workspace.columnIds = workspace.columnIds.filter((id) => id !== columnId);
    await storageService.saveWorkspace(workspace);
  }
}

/**
 * Save a bookmark
 * @param bookmark The bookmark to save
 */
export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  await storageService.saveBookmark(bookmark);
}

/**
 * Delete a bookmark
 * @param bookmarkId The ID of the bookmark to delete
 * @param columnId The ID of the column containing the bookmark
 */
export async function deleteBookmark(
  bookmarkId: string,
  columnId: string
): Promise<void> {
  // Delete the bookmark
  await storageService.deleteBookmark(bookmarkId);

  // Update column bookmarkIds
  const columns = await storageService.getColumns();
  const column = columns[columnId];
  if (column) {
    column.bookmarkIds = column.bookmarkIds.filter((id) => id !== bookmarkId);
    await storageService.saveColumn(column);
  }
}

/**
 * Open a bookmark and track the click
 * @param bookmarkId The ID of the bookmark to open
 * @param url The URL to open
 */
export async function openBookmark(
  bookmarkId: string,
  url: string
): Promise<void> {
  try {
    // Track the click
    await analyticsService.trackBookmarkClick(bookmarkId);

    // Open the URL in a new tab with error handling
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("Error opening tab:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  } catch (error) {
    console.error("Error in openBookmark:", error);
    throw error;
  }
}

/**
 * Add the current page as a bookmark
 * @param columnId The ID of the column to add the bookmark to
 */
export async function addCurrentPage(columnId?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const tab = tabs[0];
        const workspaceSettings = await storageService.getWorkspaceSettings();
        const activeWorkspaceId = workspaceSettings.lastVisitedWorkspaceId;

        // Determine target column
        let targetColumnId = columnId;

        if (!targetColumnId) {
          // If no column specified, get the first column in the active workspace
          const columns = await storageService.getWorkspaceColumns(
            activeWorkspaceId
          );

          if (columns.length === 0) {
            reject(new Error("No columns found in workspace"));
            return;
          }

          targetColumnId = columns[0].id;
        }

        // Create new bookmark
        const newBookmark: Bookmark = {
          id: Date.now().toString(),
          title: tab.title || "Untitled",
          url: tab.url || "",
          favicon: tab.favIconUrl || "",
          createdAt: new Date().toISOString(),
          columnId: targetColumnId,
          workspaceId: activeWorkspaceId,
        };

        // Add bookmark to storage
        await storageService.saveBookmark(newBookmark);

        // Add bookmark ID to column
        const columns = await storageService.getColumns();
        const column = columns[targetColumnId];
        if (column) {
          column.bookmarkIds = [newBookmark.id, ...column.bookmarkIds];
          await storageService.saveColumn(column);
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Move a bookmark from one column to another
 * @param bookmarkId The ID of the bookmark to move
 * @param sourceColumnId The ID of the source column
 * @param targetColumnId The ID of the target column
 */
export async function moveBookmark(
  bookmarkId: string,
  sourceColumnId: string,
  targetColumnId: string
): Promise<void> {
  // Get the bookmark
  const bookmark = await storageService.getBookmark(bookmarkId);
  if (!bookmark) throw new Error("Bookmark not found");

  // Get source and target columns
  const sourceColumn = (await storageService.getColumns())[sourceColumnId];
  const targetColumn = (await storageService.getColumns())[targetColumnId];

  if (!sourceColumn || !targetColumn) throw new Error("Column not found");

  // Update source column (remove bookmark ID)
  sourceColumn.bookmarkIds = sourceColumn.bookmarkIds.filter(
    (id) => id !== bookmarkId
  );
  await storageService.saveColumn(sourceColumn);

  // Update target column (add bookmark ID at the top)
  targetColumn.bookmarkIds = [bookmarkId, ...targetColumn.bookmarkIds];
  await storageService.saveColumn(targetColumn);

  // Update bookmark's column ID
  bookmark.columnId = targetColumnId;
  await storageService.saveBookmark(bookmark);
}
