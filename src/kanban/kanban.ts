// Main Kanban module that coordinates all Kanban functionality
import "./kanban.css";
import { elements } from "./elements";
import { KanbanState } from "./types";
import { showNotification, openUrl } from "./ui-utils";
import * as dataService from "./data";
import { createColumnElement } from "./component-factory";
import { setupDragAndDrop, cleanupDragAndDrop } from "./drag-drop";
import * as modals from "./modals";

// Current application state
let state: KanbanState = {
  activeWorkspaceId: "",
  workspaces: {},
  columns: {},
  bookmarks: {},
};

/**
 * Initialize the Kanban board
 */
async function initKanban(): Promise<void> {
  try {
    // Load data
    await loadData();

    // Render UI
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
  openUrl("settings.html");
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
