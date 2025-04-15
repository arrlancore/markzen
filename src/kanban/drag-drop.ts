// Drag and drop functionality for the Kanban board
import { moveBookmark } from "./data";
import { showNotification } from "./ui-utils";

/**
 * Set up drag and drop functionality for the kanban board
 */
export function setupDragAndDrop(): void {
  // Add drag start event to all bookmark cards
  document.addEventListener("dragstart", handleDragStart);

  // Add drag events to column bodies
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);
}

/**
 * Handle drag start event
 */
function handleDragStart(e: DragEvent): void {
  const target = e.target as HTMLElement;

  // Check if dragged element is a bookmark card
  if (!target.classList.contains("bookmark-card")) return;

  // Add dragging class
  target.classList.add("dragging");

  // Set drag data
  if (e.dataTransfer) {
    e.dataTransfer.setData("text/plain", target.dataset.id || "");
    e.dataTransfer.effectAllowed = "move";
  }
}

/**
 * Handle drag over event
 */
function handleDragOver(e: DragEvent): void {
  const target = e.target as HTMLElement;

  // Find closest column body
  const columnBody = target.closest(".column-body");
  if (!columnBody) return;

  e.preventDefault();

  // Add dragging-over class
  columnBody.classList.add("dragging-over");

  // Allow drop
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
}

/**
 * Handle drag leave event
 */
function handleDragLeave(e: DragEvent): void {
  const target = e.target as HTMLElement;

  // Find closest column body
  const columnBody = target.closest(".column-body");
  if (!columnBody) return;

  // Only remove the class if we're leaving the column body
  // This prevents flickering when moving within the column
  const relatedTarget = e.relatedTarget as HTMLElement;
  if (!columnBody.contains(relatedTarget)) {
    columnBody.classList.remove("dragging-over");
  }
}

/**
 * Handle drop event
 */
async function handleDrop(e: DragEvent): Promise<void> {
  e.preventDefault();

  const target = e.target as HTMLElement;

  // Find closest column body
  const columnBody = target.closest(".column-body");
  if (!columnBody) return;

  // Remove dragging-over class
  columnBody.classList.remove("dragging-over");

  // Get bookmark ID from drag data
  const bookmarkId = e.dataTransfer?.getData("text/plain");
  if (!bookmarkId) return;

  // Get target column ID
  const targetColumnId = (columnBody as HTMLElement).dataset.columnId;
  if (!targetColumnId) return;

  // Find the dragged element and get its source column
  const draggedElement = document.querySelector(
    `.bookmark-card[data-id="${bookmarkId}"]`
  );
  if (!draggedElement) return;

  // Remove dragging class
  draggedElement.classList.remove("dragging");

  // Find the source column
  const sourceColumnBody = draggedElement.closest(".column-body");
  if (!sourceColumnBody) return;

  const sourceColumnId = (sourceColumnBody as HTMLElement).dataset.columnId;
  if (!sourceColumnId) return;

  // If source and target are the same, do nothing
  if (sourceColumnId === targetColumnId) return;

  try {
    // Move the bookmark between columns
    await moveBookmark(bookmarkId, sourceColumnId, targetColumnId);

    // Refresh the UI (this will be handled by the main kanban module)
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(
      `Error moving bookmark: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Clean up drag and drop event listeners
 */
export function cleanupDragAndDrop(): void {
  document.removeEventListener("dragstart", handleDragStart);
  document.removeEventListener("dragover", handleDragOver);
  document.removeEventListener("dragleave", handleDragLeave);
  document.removeEventListener("drop", handleDrop);
}
