// Main Kanban module that coordinates all Kanban functionality
import "./kanban.css";
import { elements } from "./elements";
import { KanbanState } from "./types";
import { showNotification, openUrl } from "./ui-utils";
import * as dataService from "./data";
import { createColumnElement } from "./component-factory";
import { setupDragAndDrop, cleanupDragAndDrop } from "./drag-drop";
import * as modals from "./modals";
import themeService from "@/utils/theme-service";
import storageService, { AppSettings } from "@/utils/storage";
import { Column } from "@/models/bookmark";

// Current application state
let state: KanbanState = {
  activeWorkspaceId: "",
  workspaces: {},
  columns: {},
  bookmarks: {},
};

// Add a variable to store settings
let appSettings: AppSettings;

/**
 * Initialize the Kanban board
 */
async function initKanban(): Promise<void> {
  try {
    // Initialize storage service first and ensure correct storage type
    await storageService.initialize();

    // Load app settings
    appSettings = await storageService.getSettings();

    // Then load data
    await loadData();

    // Render UI
    await themeService.applyTheme(appSettings.theme);
    renderWorkspaceSelector();
    renderKanbanBoard();

    // Set up event listeners
    setupEventListeners();
    setupDragAndDrop();
    modals.initModalHandlers();

    // Listen for refresh events
    document.addEventListener("kanban:refresh", handleRefresh);

    // Remove loading indicator
    const loadingIndicator =
      elements.kanbanBoard.querySelector(".kanban-loading");
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  } catch (error) {
    showNotification(
      `Error initializing Kanban board: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Load data from storage
 */
async function loadData(): Promise<void> {
  state = await dataService.loadData();
}

/**
 * Render the workspace selector
 */
function renderWorkspaceSelector(): void {
  // Clear previous options
  elements.workspaceSelect.innerHTML = "";

  // Add options for each workspace
  Object.values(state.workspaces).forEach((workspace) => {
    const option = document.createElement("option");
    option.value = workspace.id;
    option.textContent = workspace.name;
    option.selected = workspace.id === state.activeWorkspaceId;

    elements.workspaceSelect.appendChild(option);
  });
}

/**
 * Render the Kanban board
 */
function renderKanbanBoard(): void {
  // Clear previous content
  elements.kanbanBoard.innerHTML = "";

  // Get columns for active workspace
  const workspaceColumnsList = Object.values(state.columns)
    .filter((column) => column.workspaceId === state.activeWorkspaceId)
    .sort((a, b) => a.order - b.order);

  // If no columns, show message
  if (workspaceColumnsList.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "kanban-empty-state";
    emptyState.innerHTML = `
      <div class="empty-state-message">
        <h3>No columns in this workspace</h3>
        <p>Click "Add Column" to get started</p>
      </div>
    `;
    elements.kanbanBoard.appendChild(emptyState);
    return;
  }

  // Create column elements
  workspaceColumnsList.forEach((column) => {
    const columnElement = createColumnElement(column, state, {
      editColumn: (id) => modals.openEditColumnModal(id, state.columns),
      addBookmark: (columnId) => modals.openAddBookmarkModal(columnId),
      // Add archive functionality callback
      archiveBookmark: (bookmarkId, sourceColumnId) =>
        archiveBookmark(bookmarkId, sourceColumnId),
    });
    elements.kanbanBoard.appendChild(columnElement);
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Workspace select change
  elements.workspaceSelect.addEventListener("change", handleWorkspaceChange);

  // Add workspace button
  elements.addWorkspaceBtn.addEventListener(
    "click",
    modals.openAddWorkspaceModal
  );

  // Edit workspace button
  elements.editWorkspaceBtn.addEventListener("click", () => {
    modals.openEditWorkspaceModal(state.activeWorkspaceId, state.workspaces);
  });

  // Add column button
  elements.addColumnBtn.addEventListener("click", modals.openAddColumnModal);

  // Settings button
  elements.settingsBtn.addEventListener("click", handleOpenSettings);

  // Add bookmark button (if it exists)
  elements.addBookmarkBtn?.addEventListener("click", handleAddCurrentPage);
}

/**
 * Handle workspace change
 */
async function handleWorkspaceChange(): Promise<void> {
  try {
    const selectedWorkspaceId = elements.workspaceSelect.value;
    state.activeWorkspaceId = selectedWorkspaceId;
    await dataService.switchWorkspace(selectedWorkspaceId);
    renderKanbanBoard();
  } catch (error) {
    showNotification(
      `Error switching workspace: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Handle adding current page as bookmark
 */
async function handleAddCurrentPage(): Promise<void> {
  try {
    // Get columns for the active workspace
    const workspaceColumns = Object.values(state.columns)
      .filter((column) => column.workspaceId === state.activeWorkspaceId)
      .sort((a, b) => a.order - b.order);

    // If no columns exist, show error
    if (workspaceColumns.length === 0) {
      showNotification("Please create a column first", "error");
      return;
    }

    // Add to the first column
    const firstColumn = workspaceColumns[0];
    await dataService.addCurrentPage(firstColumn.id);

    // Refresh data and UI
    await loadData();
    renderKanbanBoard();

    showNotification("Current page added to bookmarks", "success");
  } catch (error) {
    showNotification(
      `Error adding current page: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Handle opening settings
 */
function handleOpenSettings(): void {
  chrome.tabs.query({}, (tabs) => {
    // Check if settings page is already open
    const existingTab = tabs.find((tab) => tab.url?.includes("settings.html"));
    if (existingTab && existingTab.id) {
      // If it exists, switch to that tab
      chrome.tabs.update(existingTab.id, { active: true });
    } else {
      // If not, create new tab
      chrome.tabs.create({ url: "settings.html" });
    }
  });
}

/**
 * Archive a bookmark by moving it to the Archive column
 * @param bookmarkId The ID of the bookmark to archive
 * @param sourceColumnId The ID of the column containing the bookmark
 */
async function archiveBookmark(
  bookmarkId: string,
  sourceColumnId: string
): Promise<void> {
  try {
    // Get current state
    const data = await dataService.loadData();
    const bookmark = data.bookmarks[bookmarkId];

    if (!bookmark) {
      showNotification("Bookmark not found", "error");
      return;
    }

    // Find archive column or create it
    let archiveColumn = Object.values(data.columns).find(
      (col) =>
        col.workspaceId === data.activeWorkspaceId &&
        col.title.toLowerCase() === "archive"
    );

    // If no archive column exists, create one
    if (!archiveColumn) {
      // Create a new archive column
      const newArchiveColumn: Column = {
        id: `archive-${Date.now()}`,
        title: "Archive",
        bookmarkIds: [],
        workspaceId: data.activeWorkspaceId,
        createdAt: new Date().toISOString(),
        order: Object.values(data.columns).filter(
          (col) => col.workspaceId === data.activeWorkspaceId
        ).length, // Put at the end
      };

      // Save the new archive column
      await dataService.saveColumn(newArchiveColumn);

      // Update workspace columnIds
      const workspace = data.workspaces[data.activeWorkspaceId];
      if (workspace) {
        workspace.columnIds.push(newArchiveColumn.id);
        await dataService.saveWorkspace(workspace);
      }

      archiveColumn = newArchiveColumn;

      showNotification("Archive column created", "success");
    }

    // Move the bookmark to the archive column
    const targetIndex = 0; // Add to the top of the archive column
    await dataService.moveBookmark(
      bookmarkId,
      sourceColumnId,
      archiveColumn.id,
      targetIndex
    );

    showNotification(`"${bookmark.title}" moved to Archive`, "success");

    // Refresh the UI
    await loadData();
    renderKanbanBoard();
  } catch (error) {
    showNotification(
      `Error archiving bookmark: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Handle refresh event
 */
async function handleRefresh(): Promise<void> {
  await loadData();
  renderWorkspaceSelector();
  renderKanbanBoard();
}

/**
 * Clean up resources when leaving the page
 */
function cleanup(): void {
  cleanupDragAndDrop();
  document.removeEventListener("kanban:refresh", handleRefresh);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initKanban);

// Clean up when leaving the page
window.addEventListener("beforeunload", cleanup);

// Export the state for other modules to use when needed
export { state };
