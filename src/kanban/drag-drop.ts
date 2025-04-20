// Drag and drop functionality for the Kanban board
import { loadData, moveBookmark, reorderBookmark } from "./data";
import { showNotification } from "./ui-utils";
import storageService from "../utils/storage";

// Fix type declarations for draggedBookmark and draggedElement
let draggedBookmark: string | null = null;
let draggedElement: HTMLElement | null = null;
// Add to the existing variables
let dragTarget: "column" | "default-opens" | null = null;

/**
 * Set up drag and drop functionality for the kanban board and default opens
 */
export function setupDragAndDrop(): void {
  // Add drag start event to all bookmark cards and default open items
  document.addEventListener("dragstart", handleDragStart);

  // Add drag events to column bodies and default opens area
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);

  // Add dragend to clean up
  document.addEventListener("dragend", handleDragEnd);
}

/**
 * Handle drag start event - update to handle both bookmark cards and default open items
 */
function handleDragStart(e: DragEvent): void {
  const target = e.target as HTMLElement;

  // Check if dragged element is a bookmark card or default open item
  if (target.classList.contains("bookmark-card")) {
    draggedBookmark = target.dataset.id || null;
    draggedElement = target;
    dragTarget = "column";
  } else if (target.classList.contains("default-open-item")) {
    draggedBookmark = target.dataset.id || null;
    draggedElement = target;
    dragTarget = "default-opens";
  } else {
    return; // Not a draggable element
  }

  // Add dragging class after a small delay to ensure it's visible during drag
  setTimeout(() => {
    target.classList.add("dragging");
  }, 0);

  // Set drag data
  if (e.dataTransfer) {
    e.dataTransfer.setData("text/plain", target.dataset.id || "");
    e.dataTransfer.setData("dragTarget", dragTarget);
    e.dataTransfer.effectAllowed = "move";
  }
}

/**
 * Handle drag over event - update to handle both column bodies and default opens area
 */
function handleDragOver(e: DragEvent): void {
  e.preventDefault();

  const target = e.target as HTMLElement;

  // Check if target is column body or default opens area
  const columnBody = target.closest(".column-body");
  const defaultOpensBody = target.closest(".default-opens-body");

  if (!columnBody && !defaultOpensBody) return;

  // Handle drag over for column body
  if (columnBody) {
    // Add dragging-over class
    columnBody.classList.add("dragging-over");

    // Allow drop
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    // Show drop position indicator
    updateDropPositionIndicator(columnBody, e.clientY);
  }

  // Handle drag over for default opens area
  if (defaultOpensBody) {
    // Add drag-active class to container
    const defaultOpensContainer = document.getElementById(
      "default-opens-container"
    );
    if (defaultOpensContainer) {
      defaultOpensContainer.classList.add("drag-active");
    }

    // Allow drop
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    // If dragging a default open item, show position indicator
    if (dragTarget === "default-opens") {
      updateDefaultOpensPositionIndicator(defaultOpensBody, e.clientX);
    }
  }
}

/**
 * Update the position indicator for default opens area
 */
function updateDefaultOpensPositionIndicator(
  defaultOpensBody: Element,
  x: number
): void {
  // Remove any existing indicator
  const existingIndicator = document.querySelector(
    ".default-opens-placeholder"
  );
  if (existingIndicator) {
    existingIndicator.remove();
  }

  // Get the default opens list element
  const defaultOpensList = defaultOpensBody.querySelector(
    ".default-opens-list"
  );
  if (!defaultOpensList) return;

  // Get all items except the one being dragged
  const items = Array.from(
    defaultOpensList.querySelectorAll(".default-open-item:not(.dragging)")
  );

  // Create indicator
  const indicator = document.createElement("div");
  indicator.className = "default-opens-placeholder";

  // Find where to insert the indicator
  let insertBefore = null;

  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const middle = rect.left + rect.width / 2;

    if (x < middle) {
      insertBefore = item;
      break;
    }
  }

  if (insertBefore) {
    defaultOpensList.insertBefore(indicator, insertBefore);
  } else {
    defaultOpensList.appendChild(indicator);
  }
}

/**
 * Handle drag leave event - update to handle both column bodies and default opens area
 */
function handleDragLeave(e: DragEvent): void {
  const target = e.target as HTMLElement;
  const relatedTarget = e.relatedTarget as HTMLElement;

  // Handle leaving column body
  const columnBody = target.closest(".column-body");
  if (columnBody && !columnBody.contains(relatedTarget)) {
    columnBody.classList.remove("dragging-over");

    // Remove drop indicator when leaving the column
    const indicator = columnBody.querySelector(".drop-placeholder");
    if (indicator) {
      indicator.remove();
    }
  }

  // Handle leaving default opens area
  const defaultOpensBody = target.closest(".default-opens-body");
  if (defaultOpensBody && !defaultOpensBody.contains(relatedTarget)) {
    const defaultOpensContainer = document.getElementById(
      "default-opens-container"
    );
    if (defaultOpensContainer) {
      defaultOpensContainer.classList.remove("drag-active");
    }

    // Remove drop indicator when leaving the default opens area
    const indicator = defaultOpensBody.querySelector(
      ".default-opens-placeholder"
    );
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
  const defaultOpensIndicator = document.querySelector(
    ".default-opens-placeholder"
  );

  if (dragIndicator) {
    dragIndicator.remove();
  }

  if (defaultOpensIndicator) {
    defaultOpensIndicator.remove();
  }

  // Remove dragging-over class from all columns
  document.querySelectorAll(".column-body").forEach((column) => {
    column.classList.remove("dragging-over");
  });

  // Remove drag-active class from default opens container
  const defaultOpensContainer = document.getElementById(
    "default-opens-container"
  );
  if (defaultOpensContainer) {
    defaultOpensContainer.classList.remove("drag-active");
  }

  // Remove dragging class
  if (draggedElement) {
    draggedElement.classList.remove("dragging");
  }

  // Reset dragged items
  draggedBookmark = null;
  draggedElement = null;
  dragTarget = null;
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
 * Handle drop event for both column bodies and default opens area
 */
async function handleDrop(e: DragEvent): Promise<void> {
  e.preventDefault();

  // Get target element
  const target = e.target as HTMLElement;

  // Check if target is column body or default opens area
  const columnBody = target.closest(".column-body");
  const defaultOpensBody = target.closest(".default-opens-body");

  if (!columnBody && !defaultOpensBody) return;

  // Get bookmark ID from dataTransfer
  const bookmarkId = e.dataTransfer?.getData("text/plain");
  if (!bookmarkId) return;

  // Get drag source from dataTransfer
  const sourceDragTarget = e.dataTransfer?.getData("dragTarget") as
    | "column"
    | "default-opens"
    | "";

  try {
    // Handle drop on column body
    if (columnBody) {
      await handleDropOnColumn(
        e,
        columnBody as HTMLElement,
        bookmarkId,
        sourceDragTarget
      );
    }

    // Handle drop on default opens area
    if (defaultOpensBody) {
      await handleDropOnDefaultOpens(
        e,
        defaultOpensBody as HTMLElement,
        bookmarkId,
        sourceDragTarget
      );
    }
  } catch (error) {
    showNotification(`Error moving item: ${(error as Error).message}`, "error");
  }
}

/**
 * Handle dropping an item on a column
 */
async function handleDropOnColumn(
  e: DragEvent,
  columnBody: HTMLElement,
  bookmarkId: string,
  sourceDragTarget: "column" | "default-opens" | ""
): Promise<void> {
  // Get column ID
  const targetColumnId = columnBody.dataset.columnId;
  if (!targetColumnId) {
    console.error("Target column ID not found");
    return;
  }

  // If dropped from default opens, only remove the checkmark indicator
  // as the bookmark is already in the column
  if (sourceDragTarget === "default-opens") {
    // Get the active workspace
    const data = await loadData();
    const workspaceId = data.activeWorkspaceId;

    // Remove from default opens
    await storageService.removeDefaultOpen(workspaceId, bookmarkId);

    // Clean up visual elements
    columnBody.classList.remove("dragging-over");
    const indicator = document.querySelector(".drop-placeholder");
    if (indicator) {
      indicator.remove();
    }

    // Refresh UI to reflect changes
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);

    return;
  }

  // Otherwise, it's a regular column-to-column drag, proceed with normal handling
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

  // Handle reordering within the same column or moving between columns
  if (sourceColumnId === targetColumnId) {
    // Reordering within the same column
    await reorderBookmark(bookmarkId, targetColumnId, targetPosition);
  } else {
    // Moving between columns
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
}

/**
 * Handle dropping an item on the default opens area
 */
async function handleDropOnDefaultOpens(
  e: DragEvent,
  defaultOpensBody: HTMLElement,
  bookmarkId: string,
  sourceDragTarget: "column" | "default-opens" | ""
): Promise<void> {
  try {
    // Get the active workspace
    const data = await loadData();
    const workspaceId = data.activeWorkspaceId;

    // Clean up visual elements
    const defaultOpensContainer = document.getElementById(
      "default-opens-container"
    );
    if (defaultOpensContainer) {
      defaultOpensContainer.classList.remove("drag-active");
    }

    const indicator = document.querySelector(".default-opens-placeholder");
    if (indicator) {
      indicator.remove();
    }

    // If dragging from a column to default opens (adding new default open)
    if (sourceDragTarget === "column" || sourceDragTarget === "") {
      try {
        // Get workspace directly
        const workspace = await storageService.getWorkspace(workspaceId);
        if (!workspace) {
          throw new Error("Workspace not found");
        }

        // Initialize defaultOpenIds if needed
        workspace.defaultOpenIds = workspace.defaultOpenIds || [];

        // Check if already exists
        if (workspace.defaultOpenIds.includes(bookmarkId)) {
          showNotification("Already in default opens");
          return;
        }

        // Check limit
        if (workspace.defaultOpenIds.length >= 10) {
          showNotification(
            "Maximum number of default opens reached (10)",
            "error"
          );
          return;
        }

        // Add to default opens
        workspace.defaultOpenIds.push(bookmarkId);
        workspace.updatedAt = new Date().toISOString();

        // Save workspace
        await storageService.saveWorkspace(workspace);
        showNotification("Added to default opens", "success");
      } catch (error) {
        showNotification(`Error: ${(error as Error).message}`, "error");
        return;
      }
    }

    // Rest of the existing code for reordering...
    const workspace = await storageService.getWorkspace(workspaceId);
    if (!workspace || !workspace.defaultOpenIds) {
      throw new Error("Workspace or default opens not found");
    }

    // Determine new order
    let newOrder = [...workspace.defaultOpenIds];

    // Get all items in default opens list
    const defaultOpensList = defaultOpensBody.querySelector(
      ".default-opens-list"
    );
    if (!defaultOpensList) {
      throw new Error("Default opens list element not found");
    }

    const items = Array.from(
      defaultOpensList.querySelectorAll(".default-open-item:not(.dragging)")
    );

    // Remove the dragged bookmark from current position
    newOrder = newOrder.filter((id) => id !== bookmarkId);

    // Find new position based on cursor X position
    let newPosition = newOrder.length; // Default to end

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      const itemId = (items[i] as HTMLElement).dataset.id;

      if (e.clientX < rect.left + rect.width / 2) {
        // Find the position in newOrder array
        newPosition = newOrder.findIndex((id) => id === itemId);
        if (newPosition === -1) newPosition = i;
        break;
      }
    }

    // Insert at new position
    newOrder.splice(newPosition, 0, bookmarkId);

    // Update default opens order
    await storageService.reorderDefaultOpens(workspaceId, newOrder);

    // Refresh UI to reflect changes
    const refreshEvent = new CustomEvent("kanban:refresh");
    document.dispatchEvent(refreshEvent);
  } catch (error) {
    showNotification(`Error: ${(error as Error).message}`, "error");
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
