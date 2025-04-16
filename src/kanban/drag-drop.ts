// Drag and drop functionality for the Kanban board
import { moveBookmark } from "./data";
import { showNotification } from "./ui-utils";
import storageService from "../utils/storage";

// Fix type declarations for draggedBookmark and draggedElement
let draggedBookmark: string | null = null;
let draggedElement: HTMLElement | null = null;

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

  // Add dragend to clean up
  document.addEventListener("dragend", handleDragEnd);
}

/**
 * Handle drag start event
 */
function handleDragStart(e: DragEvent): void {
  const target = e.target as HTMLElement;

  // Check if dragged element is a bookmark card
  if (!target.classList.contains("bookmark-card")) return;

  // Set the dragged bookmark and element
  draggedBookmark = target.dataset.id || null;
  draggedElement = target;

  // Add dragging class after a small delay to ensure it's visible during drag
  setTimeout(() => {
    target.classList.add("dragging");
  }, 0);

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
  e.preventDefault();

  const target = e.target as HTMLElement;
  const columnBody = target.closest(".column-body");
  if (!columnBody) return;

  // Add dragging-over class
  columnBody.classList.add("dragging-over");

  // Allow drop
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }

  // Show drop position indicator
  updateDropPositionIndicator(columnBody, e.clientY);
}

/**
 * Update the drop position indicator
 */
function updateDropPositionIndicator(columnBody: Element, y: number): void {
  // Remove any existing indicator
  const existingIndicator = document.querySelector(".drop-placeholder");
  if (existingIndicator) {
    existingIndicator.remove();
  }

  // Get all cards in this column except the one being dragged
  const cards = Array.from(
    columnBody.querySelectorAll(".bookmark-card:not(.dragging)")
  );

  // Create indicator
  const indicator = document.createElement("div");
  indicator.className = "drop-placeholder";

  // Find where to insert the indicator
  let insertBefore = null;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;

    if (y < middle) {
      insertBefore = card;
      break;
    }
  }

  if (insertBefore) {
    columnBody.insertBefore(indicator, insertBefore);
  } else {
    columnBody.appendChild(indicator);
  }
}

/**
 * Handle drag leave event
 */
function handleDragLeave(e: DragEvent): void {
  const target = e.target as HTMLElement;
  const columnBody = target.closest(".column-body");
  if (!columnBody) return;

  const relatedTarget = e.relatedTarget as HTMLElement;
  if (!columnBody.contains(relatedTarget)) {
    columnBody.classList.remove("dragging-over");

    // Remove drop indicator when leaving the column
    const indicator = columnBody.querySelector(".drop-placeholder");
    if (indicator) {
      indicator.remove();
    }
  }
}

/**
 * Handle drag end event - clean up regardless of whether drop succeeded
 */
function handleDragEnd(): void {
  // Clean up
  const dragIndicator = document.querySelector(".drop-placeholder");
  if (dragIndicator) {
    dragIndicator.remove();
  }

  // Remove dragging-over class from all columns
  document.querySelectorAll(".column-body").forEach((column) => {
    column.classList.remove("dragging-over");
  });

  // Remove dragging class
  if (draggedElement) {
    draggedElement.classList.remove("dragging");
  }

  // Reset dragged items
  draggedBookmark = null;
  draggedElement = null;
}

// In src/kanban/drag-drop.ts
// Replace the handleDrop function with this improved version

async function handleDrop(e: DragEvent): Promise<void> {
  e.preventDefault();

  // Get target column
  const target = e.target as HTMLElement;
  const columnBody = target.closest(".column-body") as HTMLElement;
  if (!columnBody) return;

  // Get IDs
  const bookmarkId = e.dataTransfer?.getData("text/plain");
  if (!bookmarkId) return;

  // Get column IDs using dataset
  const targetColumnId = columnBody.dataset.columnId;
  if (!targetColumnId) {
    console.error("Target column ID not found");
    return;
  }

  // Find the source column
  const bookmarkElement = document.querySelector(
    `.bookmark-card[data-id="${bookmarkId}"]`
  ) as HTMLElement | null;

  if (!bookmarkElement) {
    console.error("Bookmark element not found");
    return;
  }

  const sourceColumnBody = bookmarkElement.closest(
    ".column-body"
  ) as HTMLElement;
  if (!sourceColumnBody) {
    console.error("Source column not found");
    return;
  }

  const sourceColumnId = sourceColumnBody.dataset.columnId;
  if (!sourceColumnId) {
    console.error("Source column ID not found");
    return;
  }

  // Clean up visual elements
  columnBody.classList.remove("dragging-over");
  const indicator = document.querySelector(".drop-placeholder");
  if (indicator) {
    indicator.remove();
  }

  // Determine target position
  let targetPosition = 0;

  // Get all cards in target column
  const cards = Array.from(
    columnBody.querySelectorAll(".bookmark-card:not(.dragging)")
  );

  console.log(`Target column has ${cards.length} cards`);

  // Find position based on cursor Y position
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      targetPosition = i;
      break;
    }

    if (i === cards.length - 1) {
      // After the last card
      targetPosition = cards.length;
    }
  }

  console.log(`Drop position: ${targetPosition}`);

  try {
    if (sourceColumnId === targetColumnId) {
      console.log(
        `Reordering bookmark ${bookmarkId} within column ${targetColumnId} to position ${targetPosition}`
      );

      // Get the column data directly from storage to ensure we're working with the latest data
      const column = await storageService.getColumn(targetColumnId);
      if (!column) throw new Error("Column not found");

      // Get current position in data
      const currentIndex = column.bookmarkIds.indexOf(bookmarkId);
      if (currentIndex === -1) throw new Error("Bookmark not found in column");

      console.log(`Current position in data: ${currentIndex}`);
      console.log(
        `Bookmark IDs before reordering: ${column.bookmarkIds.join(", ")}`
      );

      // Create a new order array
      const newBookmarkIds = [...column.bookmarkIds];

      // Remove from current position
      newBookmarkIds.splice(currentIndex, 1);

      // Insert at new position with correction
      // If the target is after the current position, adjust for the removal
      let adjustedPosition = targetPosition;
      if (targetPosition > currentIndex) {
        adjustedPosition--;
      }

      // Ensure position is in bounds
      adjustedPosition = Math.max(
        0,
        Math.min(adjustedPosition, newBookmarkIds.length)
      );

      // Insert at new position
      newBookmarkIds.splice(adjustedPosition, 0, bookmarkId);

      console.log(
        `Bookmark IDs after reordering: ${newBookmarkIds.join(", ")}`
      );

      // Update column
      column.bookmarkIds = newBookmarkIds;
      await storageService.saveColumn(column);

      console.log("Reordering complete");
    } else {
      // Moving between columns
      console.log(
        `Moving bookmark ${bookmarkId} from column ${sourceColumnId} to column ${targetColumnId} at position ${targetPosition}`
      );

      // Handle cross-column movement differently to ensure data consistency
      await moveBookmark(
        bookmarkId,
        sourceColumnId,
        targetColumnId,
        targetPosition
      );
    }

    // Refresh UI to reflect the changes
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
  document.removeEventListener("dragend", handleDragEnd);
}
