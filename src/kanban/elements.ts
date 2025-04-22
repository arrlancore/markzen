// DOM Elements for the Kanban module

// Export all DOM elements used in the Kanban module
export const elements = {
  // Main elements
  workspaceSelect: document.getElementById(
    "workspace-select"
  ) as HTMLSelectElement,
  addWorkspaceBtn: document.getElementById(
    "add-workspace-btn"
  ) as HTMLButtonElement,
  editWorkspaceBtn: document.getElementById(
    "edit-workspace-btn"
  ) as HTMLButtonElement,
  addColumnBtn: document.getElementById("add-column-btn") as HTMLButtonElement,
  addBookmarkBtn: document.getElementById(
    "add-bookmark-btn"
  ) as HTMLButtonElement,
  settingsBtn: document.getElementById("settings-btn") as HTMLButtonElement,
  kanbanBoard: document.getElementById("kanban-board") as HTMLDivElement,

  // Workspace modal elements
  workspaceModal: document.getElementById("workspace-modal") as HTMLDivElement,
  workspaceModalTitle: document.getElementById(
    "workspace-modal-title"
  ) as HTMLHeadingElement,
  workspaceName: document.getElementById("workspace-name") as HTMLInputElement,
  workspaceDescription: document.getElementById(
    "workspace-description"
  ) as HTMLTextAreaElement,
  workspaceColor: document.getElementById(
    "workspace-color"
  ) as HTMLInputElement,
  saveWorkspaceBtn: document.getElementById(
    "save-workspace-btn"
  ) as HTMLButtonElement,
  deleteWorkspaceBtn: document.getElementById(
    "delete-workspace-btn"
  ) as HTMLButtonElement,

  // Column modal elements
  columnModal: document.getElementById("column-modal") as HTMLDivElement,
  columnModalTitle: document.getElementById(
    "column-modal-title"
  ) as HTMLHeadingElement,
  columnTitle: document.getElementById("column-title") as HTMLInputElement,
  saveColumnBtn: document.getElementById(
    "save-column-btn"
  ) as HTMLButtonElement,
  deleteColumnBtn: document.getElementById(
    "delete-column-btn"
  ) as HTMLButtonElement,

  // Bookmark modal elements
  bookmarkModal: document.getElementById("bookmark-modal") as HTMLDivElement,
  bookmarkModalTitle: document.getElementById(
    "bookmark-modal-title"
  ) as HTMLHeadingElement,
  bookmarkTitle: document.getElementById("bookmark-title") as HTMLInputElement,
  bookmarkUrl: document.getElementById("bookmark-url") as HTMLInputElement,
  bookmarkDescription: document.getElementById(
    "bookmark-description"
  ) as HTMLTextAreaElement,
  bookmarkTags: document.getElementById("bookmark-tags") as HTMLInputElement,
  saveBookmarkBtn: document.getElementById(
    "save-bookmark-btn"
  ) as HTMLButtonElement,
  deleteBookmarkBtn: document.getElementById(
    "delete-bookmark-btn"
  ) as HTMLButtonElement,

  // Delete confirmation modal elements
  deleteConfirmationModal: document.getElementById(
    "delete-confirmation-modal"
  ) as HTMLDivElement,
  deleteConfirmationMessage: document.getElementById(
    "delete-confirmation-message"
  ) as HTMLParagraphElement,
  deleteBookmarkDetails: document.getElementById(
    "delete-bookmark-details"
  ) as HTMLDivElement,
  deleteBookmarkTitle: document.getElementById(
    "delete-bookmark-title"
  ) as HTMLDivElement,
  deleteBookmarkUrl: document.getElementById(
    "delete-bookmark-url"
  ) as HTMLDivElement,
  confirmDeleteBtn: document.getElementById(
    "confirm-delete-btn"
  ) as HTMLButtonElement,
  cancelDeleteBtn: document.getElementById(
    "cancel-delete-btn"
  ) as HTMLButtonElement,

  // Notification elements
  notification: document.getElementById("notification") as HTMLDivElement,
  notificationMessage: document.getElementById(
    "notification-message"
  ) as HTMLSpanElement,
  notificationClose: document.getElementById(
    "notification-close"
  ) as HTMLButtonElement,

  // Close modal buttons
  closeModalButtons: document.querySelectorAll("[data-close-modal]"),

  // Default opens elements
  defaultOpensContainer: document.getElementById(
    "default-opens-container"
  ) as HTMLDivElement,
  defaultOpensCount: document.getElementById(
    "default-opens-count"
  ) as HTMLSpanElement,
  defaultOpensEmpty: document.getElementById(
    "default-opens-empty"
  ) as HTMLDivElement,
  defaultOpensList: document.getElementById(
    "default-opens-list"
  ) as HTMLDivElement,
  openAllDefaultsBtn: document.getElementById(
    "open-all-defaults-btn"
  ) as HTMLButtonElement,

  // Open defaults modal elements
  openDefaultsModal: document.getElementById(
    "open-defaults-modal"
  ) as HTMLDivElement,
  openDefaultsMessage: document.getElementById(
    "open-defaults-message"
  ) as HTMLParagraphElement,
  openDefaultsCount: document.getElementById(
    "open-defaults-count"
  ) as HTMLSpanElement,
  openDefaultsCancelBtn: document.getElementById(
    "open-defaults-cancel-btn"
  ) as HTMLButtonElement,
  openDefaultsSameWindowBtn: document.getElementById(
    "open-defaults-same-window-btn"
  ) as HTMLButtonElement,
  openDefaultsNewWindowBtn: document.getElementById(
    "open-defaults-new-window-btn"
  ) as HTMLButtonElement,
  noteBtn: document.getElementById("note-btn") as HTMLButtonElement,
};
