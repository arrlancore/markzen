// UI Utilities for the Kanban board
import { elements } from "./elements";
import { NotificationType } from "./types";

/**
 * Show a notification message
 * @param message The message to display
 * @param type The type of notification (success, error, warning)
 */
export function showNotification(
  message: string,
  type: NotificationType = "success"
): void {
  elements.notificationMessage.textContent = message;
  elements.notification.className = `notification ${type}`;

  // Remove hidden class
  elements.notification.classList.remove("hidden");

  // Hide notification after 3 seconds
  setTimeout(() => {
    elements.notification.classList.add("hidden");
  }, 3000);
}

/**
 * Open a modal
 * @param modal The modal element to open
 */
export function openModal(modal: HTMLElement): void {
  modal.classList.add("active");
}

/**
 * Close a modal and reset its form fields
 * @param modal The modal element to close
 */
export function closeModal(modal: HTMLElement): void {
  modal.classList.remove("active");

  // Reset form fields based on the modal type
  if (modal === elements.workspaceModal) {
    elements.workspaceName.value = "";
    elements.workspaceDescription.value = "";
    elements.workspaceColor.value = "#3b82f6";
    elements.deleteWorkspaceBtn.classList.add("hidden");
  } else if (modal === elements.columnModal) {
    elements.columnTitle.value = "";
    elements.deleteColumnBtn.classList.add("hidden");
  } else if (modal === elements.bookmarkModal) {
    elements.bookmarkTitle.value = "";
    elements.bookmarkUrl.value = "";
    elements.bookmarkDescription.value = "";
    elements.bookmarkTags.value = "";
    elements.deleteBookmarkBtn.classList.add("hidden");
  }
}

/**
 * Open a URL in a new tab
 * @param url The URL to open
 */
export function openUrl(url: string): void {
  chrome.tabs.create({ url });
}

/**
 * Confirm an action with the user
 * @param message The confirmation message
 * @returns A Promise that resolves to true if confirmed, false otherwise
 */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    resolve(confirm(message));
  });
}
