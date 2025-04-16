// Modal management for the Kanban board
import { Bookmark, Column } from "../models/bookmark";
import { elements } from "./elements";
import {
  openModal,
  closeModal,
  confirmAction,
  showNotification,
} from "./ui-utils";
import { EditingState, DeleteType } from "./types";
import * as dataService from "./data";
import { Workspace } from "../models/workspace";

// Current editing state
const editingState: EditingState = {
  currentWorkspaceId: null,
  currentColumnId: null,
  currentBookmarkId: null,
  currentColumnForBookmark: null,
  deleteType: null,
};

// We'll use the elements from elements.ts instead of declaring them again here

/**
 * Reset editing state
 */
function resetEditingState(): void {
  editingState.currentWorkspaceId = null;
  editingState.currentColumnId = null;
  editingState.currentBookmarkId = null;
  editingState.currentColumnForBookmark = null;
  editingState.deleteType = null;
}

// Workspace modal functions
/**
 * Open modal to add a new workspace
 */
export function openAddWorkspaceModal(): void {
  elements.workspaceModalTitle.textContent = "Add Workspace";
  elements.deleteWorkspaceBtn.classList.add("hidden");
  openModal(elements.workspaceModal);
}

/**
 * Open modal to edit an existing workspace
 * @param workspaceId ID of the workspace to edit
 * @param workspaces Record of all workspaces
 */
export function openEditWorkspaceModal(
  workspaceId: string,
  workspaces: Record<string, Workspace>
): void {
  const workspace = workspaces[workspaceId];
  if (!workspace) return;

  editingState.currentWorkspaceId = workspaceId;
  elements.workspaceModalTitle.textContent = "Edit Workspace";
  elements.workspaceName.value = workspace.name;
  elements.workspaceDescription.value = workspace.description || "";
  elements.workspaceColor.value = workspace.color || "#3b82f6";

  // Only show delete button if not the default workspace and not the only workspace
  if (workspaceId !== "default" && Object.keys(workspaces).length > 1) {
    elements.deleteWorkspaceBtn.classList.remove("hidden");
  } else {
    elements.deleteWorkspaceBtn.classList.add("hidden");
  }

  openModal(elements.workspaceModal);
}

/**
 * Save a workspace (create new or update existing)
 */
async function saveWorkspace(): Promise<void> {
  try {
    const name = elements.workspaceName.value.trim();
    if (!name) {
      showNotification("Workspace name is required", "error");
      return;
    }

    // Check if adding new workspace or editing existing
    if (editingState.currentWorkspaceId) {
      // Get the existing workspace
      const workspace = await dataService
        .loadData()
        .then((data) => data.workspaces[editingState.currentWorkspaceId!]);

      if (!workspace) {
        showNotification("Workspace not found", "error");
        return;
      }

      // Update the workspace
      const updatedWorkspace: Workspace = {
        ...workspace,
        name,
        description: elements.workspaceDescription.value.trim(),
        color: elements.workspaceColor.value,
        updatedAt: new Date().toISOString(),
      };

      await dataService.saveWorkspace(updatedWorkspace);
      showNotification("Workspace updated successfully", "success");
    } else {
      // Create a new workspace
      const newWorkspace: Workspace = {
        id: Date.now().toString(),
        name,
        description: elements.workspaceDescription.value.trim(),
        color: elements.workspaceColor.value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        columnIds: [],
      };

      await dataService.saveWorkspace(newWorkspace);

      // Switch to the new workspace
      await dataService.switchWorkspace(newWorkspace.id);

      showNotification("Workspace added successfully", "success");
    }

    // Close modal
    closeModal(elements.workspaceModal);
    resetEditingState();

    // Trigger refresh
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(
      `Error saving workspace: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Open delete confirmation for workspace
 */
async function confirmDeleteWorkspace(): Promise<void> {
  if (!editingState.currentWorkspaceId) return;

  try {
    const data = await dataService.loadData();
    const workspace = data.workspaces[editingState.currentWorkspaceId];

    if (!workspace) {
      showNotification("Workspace not found", "error");
      return;
    }

    // Hide bookmark details section
    if (elements.deleteBookmarkDetails) {
      elements.deleteBookmarkDetails.style.display = "none";
    }

    // Set message
    if (elements.deleteConfirmationMessage) {
      elements.deleteConfirmationMessage.textContent =
        "Are you sure you want to delete this workspace? All columns and bookmarks in this workspace will be deleted.";
    }

    // Set delete type
    editingState.deleteType = "workspace";

    // Close edit modal and open confirmation modal
    closeModal(elements.workspaceModal);
    openModal(elements.deleteConfirmationModal);
  } catch (error) {
    showNotification(
      `Error preparing delete confirmation: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Delete the workspace
 */
async function deleteWorkspace(): Promise<void> {
  if (!editingState.currentWorkspaceId) return;

  try {
    await dataService.deleteWorkspace(editingState.currentWorkspaceId);

    // Close modal
    if (elements.deleteConfirmationModal) {
      closeModal(elements.deleteConfirmationModal);
    }
    resetEditingState();

    showNotification("Workspace deleted successfully", "success");

    // Trigger refresh
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(
      `Error deleting workspace: ${(error as Error).message}`,
      "error"
    );
  }
}

// Column modal functions
/**
 * Open modal to add a new column
 */
export function openAddColumnModal(): void {
  elements.columnModalTitle.textContent = "Add Column";
  elements.deleteColumnBtn.classList.add("hidden");
  openModal(elements.columnModal);
}

/**
 * Open modal to edit an existing column
 * @param columnId ID of the column to edit
 * @param columns Record of all columns
 */
export function openEditColumnModal(
  columnId: string,
  columns: Record<string, Column>
): void {
  const column = columns[columnId];
  if (!column) return;

  editingState.currentColumnId = columnId;
  elements.columnModalTitle.textContent = "Edit Column";
  elements.columnTitle.value = column.title;
  elements.deleteColumnBtn.classList.remove("hidden");

  openModal(elements.columnModal);
}

/**
 * Save a column (create new or update existing)
 */
async function saveColumn(): Promise<void> {
  try {
    const title = elements.columnTitle.value.trim();
    if (!title) {
      showNotification("Column title is required", "error");
      return;
    }

    const data = await dataService.loadData();

    // Check if adding new column or editing existing
    if (editingState.currentColumnId) {
      // Editing existing column
      const column = data.columns[editingState.currentColumnId];

      if (!column) {
        showNotification("Column not found", "error");
        return;
      }

      const updatedColumn: Column = {
        ...column,
        title,
      };

      await dataService.saveColumn(updatedColumn);
      showNotification("Column updated successfully", "success");
    } else {
      // Adding new column
      const workspaceColumnsList = Object.values(data.columns).filter(
        (column) => column.workspaceId === data.activeWorkspaceId
      );

      const newColumn: Column = {
        id: Date.now().toString(),
        title,
        bookmarkIds: [],
        workspaceId: data.activeWorkspaceId,
        createdAt: new Date().toISOString(),
        order: workspaceColumnsList.length,
      };

      await dataService.saveColumn(newColumn);

      // Update workspace columnIds
      const workspace = data.workspaces[data.activeWorkspaceId];
      if (workspace) {
        workspace.columnIds.push(newColumn.id);
        await dataService.saveWorkspace(workspace);
      }

      showNotification("Column added successfully", "success");
    }

    // Close modal
    closeModal(elements.columnModal);
    resetEditingState();

    // Trigger refresh
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(
      `Error saving column: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Open delete confirmation for column
 */
async function confirmDeleteColumn(): Promise<void> {
  if (!editingState.currentColumnId) return;

  try {
    const data = await dataService.loadData();
    const column = data.columns[editingState.currentColumnId];

    if (!column) {
      showNotification("Column not found", "error");
      return;
    }

    // Hide bookmark details section
    if (elements.deleteBookmarkDetails) {
      elements.deleteBookmarkDetails.style.display = "none";
    }

    // Set message
    if (elements.deleteConfirmationMessage) {
      elements.deleteConfirmationMessage.textContent = `Are you sure you want to delete the column "${column.title}"? All bookmarks in this column will be deleted.`;
    }

    // Set delete type
    editingState.deleteType = "column";

    // Close edit modal and open confirmation modal
    closeModal(elements.columnModal);
    openModal(elements.deleteConfirmationModal);
  } catch (error) {
    showNotification(
      `Error preparing delete confirmation: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Delete the column
 */
async function deleteColumn(): Promise<void> {
  if (!editingState.currentColumnId) return;

  try {
    const data = await dataService.loadData();
    await dataService.deleteColumn(
      editingState.currentColumnId,
      data.activeWorkspaceId
    );

    // Close modal
    if (elements.deleteConfirmationModal) {
      closeModal(elements.deleteConfirmationModal);
    }
    resetEditingState();

    showNotification("Column deleted successfully", "success");

    // Trigger refresh
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(
      `Error deleting column: ${(error as Error).message}`,
      "error"
    );
  }
}

// Bookmark modal functions
/**
 * Open modal to add a new bookmark
 * @param columnId ID of the column to add the bookmark to
 */
export function openAddBookmarkModal(columnId: string): void {
  elements.bookmarkModalTitle.textContent = "Add Bookmark";
  elements.deleteBookmarkBtn.classList.add("hidden");
  editingState.currentColumnForBookmark = columnId;

  // Clear previous values
  elements.bookmarkTitle.value = "";
  elements.bookmarkUrl.value = "";
  elements.bookmarkDescription.value = "";
  elements.bookmarkTags.value = "";

  openModal(elements.bookmarkModal);
}

/**
 * Open modal to edit an existing bookmark
 * @param bookmarkId ID of the bookmark to edit
 * @param bookmarks Record of all bookmarks
 */
export function openEditBookmarkModal(
  bookmarkId: string,
  bookmarks: Record<string, Bookmark>
): void {
  const bookmark = bookmarks[bookmarkId];
  if (!bookmark) {
    showNotification("Bookmark not found", "error");
    return;
  }

  editingState.currentBookmarkId = bookmarkId;
  editingState.currentColumnForBookmark = bookmark.columnId;

  elements.bookmarkModalTitle.textContent = "Edit Bookmark";
  elements.bookmarkTitle.value = bookmark.title;
  elements.bookmarkUrl.value = bookmark.url;
  elements.bookmarkDescription.value = bookmark.description || "";
  elements.bookmarkTags.value = bookmark.tags ? bookmark.tags.join(", ") : "";
  elements.deleteBookmarkBtn.classList.remove("hidden");

  openModal(elements.bookmarkModal);
}

/**
 * Save a bookmark (create new or update existing)
 */
async function saveBookmark(): Promise<void> {
  try {
    const title = elements.bookmarkTitle.value.trim();
    const url = elements.bookmarkUrl.value.trim();

    if (!title) {
      showNotification("Bookmark title is required", "error");
      return;
    }

    if (!url) {
      showNotification("Bookmark URL is required", "error");
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      showNotification("Please enter a valid URL", "error");
      return;
    }

    const data = await dataService.loadData();

    // Parse tags
    const tagsString = elements.bookmarkTags.value.trim();
    const tags = tagsString
      ? tagsString
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    // Check if adding new bookmark or editing existing
    if (editingState.currentBookmarkId) {
      // Editing existing bookmark
      const bookmark = data.bookmarks[editingState.currentBookmarkId];

      if (!bookmark) {
        showNotification("Bookmark not found", "error");
        return;
      }

      const updatedBookmark: Bookmark = {
        ...bookmark,
        title,
        url,
        description: elements.bookmarkDescription.value.trim(),
        tags,
        updatedAt: new Date().toISOString(),
      };

      await dataService.saveBookmark(updatedBookmark);
      showNotification("Bookmark updated successfully", "success");
    } else {
      // Adding new bookmark
      if (!editingState.currentColumnForBookmark) {
        showNotification("Column not specified", "error");
        return;
      }

      // Try to get favicon from the URL
      let favicon = "";
      try {
        // Extract domain for favicon
        const urlObj = new URL(url);
        favicon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
      } catch (e) {
        console.error("Error generating favicon URL:", e);
      }

      const newBookmark: Bookmark = {
        id: Date.now().toString(),
        title,
        url,
        favicon, // Basic favicon URL - will be updated when visiting the page
        description: elements.bookmarkDescription.value.trim(),
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        columnId: editingState.currentColumnForBookmark,
        workspaceId: data.activeWorkspaceId,
      };

      // Add bookmark to storage
      await dataService.saveBookmark(newBookmark);

      // Add bookmark ID to column
      const column = data.columns[editingState.currentColumnForBookmark];
      if (column) {
        column.bookmarkIds = [newBookmark.id, ...column.bookmarkIds];
        await dataService.saveColumn(column);
      }

      showNotification("Bookmark added successfully", "success");
    }

    // Close modal
    closeModal(elements.bookmarkModal);
    resetEditingState();

    // Trigger refresh
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(
      `Error saving bookmark: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Prepare for bookmark deletion directly from the delete menu
 * @param bookmarkId ID of the bookmark to delete
 * @param columnId ID of the column containing the bookmark
 * @param bookmarks Record of all bookmarks
 */
export async function confirmBookmarkDeletion(
  bookmarkId: string,
  columnId: string,
  bookmarks: Record<string, Bookmark>
): Promise<void> {
  // Set state needed for deletion
  editingState.currentBookmarkId = bookmarkId;
  editingState.currentColumnForBookmark = columnId;

  try {
    const bookmark = bookmarks[bookmarkId];

    if (!bookmark) {
      showNotification("Bookmark not found", "error");
      return;
    }

    // Show bookmark details section
    if (elements.deleteBookmarkDetails) {
      elements.deleteBookmarkDetails.style.display = "block";
    }

    // Set bookmark details
    if (elements.deleteBookmarkTitle) {
      elements.deleteBookmarkTitle.textContent = bookmark.title;
    }

    if (elements.deleteBookmarkUrl) {
      elements.deleteBookmarkUrl.textContent = bookmark.url;
    }

    // Set message
    if (elements.deleteConfirmationMessage) {
      elements.deleteConfirmationMessage.textContent =
        "Are you sure you want to delete this bookmark?";
    }

    // Set delete type
    editingState.deleteType = "bookmark";

    // Open confirmation modal
    openModal(elements.deleteConfirmationModal);
  } catch (error) {
    showNotification(
      `Error preparing delete confirmation: ${(error as Error).message}`,
      "error"
    );
  }
}
/**
 * Open delete confirmation for bookmark
 */
export async function confirmDeleteBookmark(): Promise<void> {
  if (!editingState.currentBookmarkId || !editingState.currentColumnForBookmark)
    return;

  try {
    const data = await dataService.loadData();
    const bookmark = data.bookmarks[editingState.currentBookmarkId];

    if (!bookmark) {
      showNotification("Bookmark not found", "error");
      return;
    }

    // Show bookmark details section
    if (elements.deleteBookmarkDetails) {
      elements.deleteBookmarkDetails.style.display = "block";
    }

    // Set bookmark details
    if (elements.deleteBookmarkTitle) {
      elements.deleteBookmarkTitle.textContent = bookmark.title;
    }

    if (elements.deleteBookmarkUrl) {
      elements.deleteBookmarkUrl.textContent = bookmark.url;
    }

    // Set message
    if (elements.deleteConfirmationMessage) {
      elements.deleteConfirmationMessage.textContent =
        "Are you sure you want to delete this bookmark?";
    }

    // Set delete type
    editingState.deleteType = "bookmark";

    // Close edit modal and open confirmation modal
    closeModal(elements.bookmarkModal);
    openModal(elements.deleteConfirmationModal);
  } catch (error) {
    showNotification(
      `Error preparing delete confirmation: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Delete the bookmark
 */
async function deleteBookmark(): Promise<void> {
  if (!editingState.currentBookmarkId || !editingState.currentColumnForBookmark)
    return;

  try {
    await dataService.deleteBookmark(
      editingState.currentBookmarkId,
      editingState.currentColumnForBookmark
    );

    // Close modal
    if (elements.deleteConfirmationModal) {
      closeModal(elements.deleteConfirmationModal);
    }
    resetEditingState();

    showNotification("Bookmark deleted successfully", "success");

    // Trigger refresh
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(
      `Error deleting bookmark: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Handle confirmation action based on delete type
 */
async function handleDeleteConfirmation(): Promise<void> {
  switch (editingState.deleteType) {
    case "bookmark":
      await deleteBookmark();
      break;
    case "column":
      await deleteColumn();
      break;
    case "workspace":
      await deleteWorkspace();
      break;
    default:
      if (elements.deleteConfirmationModal) {
        closeModal(elements.deleteConfirmationModal);
      }
      resetEditingState();
      break;
  }
}

/**
 * Initialize modal event handlers
 */
export function initModalHandlers(): void {
  // Save workspace button
  elements.saveWorkspaceBtn.addEventListener("click", saveWorkspace);

  // Delete workspace button
  elements.deleteWorkspaceBtn.addEventListener("click", confirmDeleteWorkspace);

  // Save column button
  elements.saveColumnBtn.addEventListener("click", saveColumn);

  // Delete column button
  elements.deleteColumnBtn.addEventListener("click", confirmDeleteColumn);

  // Save bookmark button
  elements.saveBookmarkBtn.addEventListener("click", saveBookmark);

  // Delete bookmark button
  elements.deleteBookmarkBtn.addEventListener("click", confirmDeleteBookmark);

  // Close modal buttons
  elements.closeModalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      closeModal(elements.workspaceModal);
      closeModal(elements.columnModal);
      closeModal(elements.bookmarkModal);
      resetEditingState();
    });
  });

  // Notification close button
  elements.notificationClose?.addEventListener("click", () => {
    elements.notification.classList.add("hidden");
  });

  // Delete confirmation modal handlers
  if (elements.confirmDeleteBtn) {
    elements.confirmDeleteBtn.addEventListener(
      "click",
      handleDeleteConfirmation
    );
  }

  if (elements.cancelDeleteBtn) {
    elements.cancelDeleteBtn.addEventListener("click", () => {
      if (elements.deleteConfirmationModal) {
        closeModal(elements.deleteConfirmationModal);
      }
      resetEditingState();
    });
  }

  // Close button for delete confirmation modal
  const deleteModalCloseBtn = elements.deleteConfirmationModal?.querySelector(
    ".modal-close"
  ) as HTMLButtonElement;
  if (deleteModalCloseBtn) {
    deleteModalCloseBtn.addEventListener("click", () => {
      if (elements.deleteConfirmationModal) {
        closeModal(elements.deleteConfirmationModal);
      }
      resetEditingState();
    });
  }
}
