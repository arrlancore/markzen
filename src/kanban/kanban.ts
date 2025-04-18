// Main Kanban module that coordinates all Kanban functionality
import "./kanban.css";
import { elements } from "./elements";
import { KanbanState } from "./types";
import { showNotification, openUrl, openModal, closeModal } from "./ui-utils";
import * as dataService from "./data";
import {
  createBookmarkElement,
  createColumnElement,
  createDefaultOpenElement,
} from "./component-factory";
import { setupDragAndDrop, cleanupDragAndDrop } from "./drag-drop";
import * as modals from "./modals";
import themeService from "@/utils/theme-service";
import storageService, { AppSettings } from "@/utils/storage";
import { Column } from "@/models/bookmark";
import analyticsService from "@/utils/analytics";

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
    await renderDefaultOpens(); // Add this line to render default opens
    renderKanbanBoard();

    // Set up event listeners
    setupEventListeners();
    setupDragAndDrop();
    modals.initModalHandlers();
    setupDefaultOpensHandlers(); // Add this line to set up default opens handlers

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

// Add function to set up default opens event handlers
function setupDefaultOpensHandlers(): void {
  // Open all defaults button
  elements.openAllDefaultsBtn.addEventListener("click", handleOpenAllDefaults);

  // Open defaults modal buttons
  elements.openDefaultsSameWindowBtn.addEventListener(
    "click",
    openDefaultsInCurrentWindow
  );
  elements.openDefaultsNewWindowBtn.addEventListener(
    "click",
    openDefaultsInNewWindow
  );
}

// Update the createBookmarkElement function to check if bookmark is in default opens
function isBookmarkInDefaultOpens(bookmarkId: string): boolean {
  // Check if the active workspace has defaultOpenIds and if bookmarkId is in it
  const workspace = state.workspaces[state.activeWorkspaceId];
  return !!(
    workspace &&
    workspace.defaultOpenIds &&
    workspace.defaultOpenIds.includes(bookmarkId)
  );
}

// Update the handleRefresh function to include default opens
async function handleRefresh(): Promise<void> {
  await loadData();
  renderWorkspaceSelector();
  await renderDefaultOpens(); // Add this line
  renderKanbanBoard();
}

// Update handleWorkspaceChange to refresh default opens
async function handleWorkspaceChange(): Promise<void> {
  try {
    const selectedWorkspaceId = elements.workspaceSelect.value;
    state.activeWorkspaceId = selectedWorkspaceId;
    await dataService.switchWorkspace(selectedWorkspaceId);
    await renderDefaultOpens(); // Add this line
    renderKanbanBoard();
  } catch (error) {
    showNotification(
      `Error switching workspace: ${(error as Error).message}`,
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

async function renderDefaultOpens(): Promise<void> {
  try {
    // Get default opens for active workspace
    const defaultOpens = await storageService.getDefaultOpens(
      state.activeWorkspaceId
    );

    // Get all bookmarks in the workspace to check if any exist
    const workspaceBookmarks = Object.values(state.bookmarks).filter(
      (bookmark) => bookmark.workspaceId === state.activeWorkspaceId
    );

    // If no bookmarks in workspace, hide default opens container
    if (workspaceBookmarks.length === 0) {
      elements.defaultOpensContainer.classList.add("hidden");
      return;
    }

    // Show default opens container
    elements.defaultOpensContainer.classList.remove("hidden");

    // Update count
    elements.defaultOpensCount.textContent = defaultOpens.length.toString();

    // Clear previous content
    elements.defaultOpensList.innerHTML = "";

    // Show/hide empty state and button
    if (defaultOpens.length === 0) {
      elements.defaultOpensEmpty.classList.remove("hidden");
      elements.openAllDefaultsBtn.classList.add("hidden");
    } else {
      elements.defaultOpensEmpty.classList.add("hidden");
      elements.openAllDefaultsBtn.classList.remove("hidden");

      // Create default open elements
      defaultOpens.forEach((bookmark) => {
        const defaultOpenElement = createDefaultOpenElement(bookmark, {
          removeDefaultOpen: (id) => handleRemoveDefaultOpen(id),
        });

        elements.defaultOpensList.appendChild(defaultOpenElement);
      });
    }
  } catch (error) {
    showNotification(
      `Error rendering default opens: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Handle removing a bookmark from default opens
 */
async function handleRemoveDefaultOpen(bookmarkId: string): Promise<void> {
  try {
    await storageService.removeDefaultOpen(state.activeWorkspaceId, bookmarkId);

    // Refresh UI
    await renderDefaultOpens();

    // Also refresh all bookmarks to update indicators
    renderKanbanBoard();

    showNotification("Removed from default opens", "success");
  } catch (error) {
    showNotification(
      `Error removing default open: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Handle opening all default bookmarks
 */
function handleOpenAllDefaults(): void {
  // Get count of default opens
  const count = parseInt(elements.defaultOpensCount.textContent || "0", 10);

  if (count === 0) {
    showNotification("No default opens to open", "warning");
    return;
  }

  // Update modal content
  elements.openDefaultsCount.textContent = count.toString();

  // Show modal
  openModal(elements.openDefaultsModal);
}

/**
 * Open all default bookmarks in current window
 */
async function openDefaultsInCurrentWindow() {
  try {
    const defaultOpens = await storageService.getDefaultOpens(
      state.activeWorkspaceId
    );
    // Use existing trackBookmarkClick instead of trackBookmarkVisit
    for (const bookmark of defaultOpens) {
      await analyticsService.trackBookmarkClick(bookmark.id);
    }

    await storageService.openDefaultBookmarks(state.activeWorkspaceId, false);
    closeModal(elements.openDefaultsModal);
    showNotification("Opening default bookmarks", "success");
  } catch (error) {
    showNotification(
      `Error opening default bookmarks: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Open all default bookmarks in new window
 */
async function openDefaultsInNewWindow() {
  try {
    const defaultOpens = await storageService.getDefaultOpens(
      state.activeWorkspaceId
    );
    // Use existing trackBookmarkClick instead of trackBookmarkVisit
    for (const bookmark of defaultOpens) {
      await analyticsService.trackBookmarkClick(bookmark.id);
    }

    await storageService.openDefaultBookmarks(state.activeWorkspaceId, true);
    closeModal(elements.openDefaultsModal);
    showNotification("Opening default bookmarks in new window", "success");
  } catch (error) {
    showNotification(
      `Error opening default bookmarks: ${(error as Error).message}`,
      "error"
    );
  }
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
