import "./popup.css";
import "../utils/storage";
import { Workspace } from "../models/workspace";
import { Bookmark } from "../models/bookmark";
import storageService from "../utils/storage";
import analyticsService from "../utils/analytics";

// DOM Elements
const showKanbanBtn = document.getElementById(
  "show-kanban-btn"
) as HTMLButtonElement;
const addBookmarkBtn = document.getElementById(
  "add-bookmark-btn"
) as HTMLButtonElement;
const workspacesList = document.getElementById(
  "workspaces-list"
) as HTMLDivElement;
const recentBookmarksList = document.getElementById(
  "recent-bookmarks-list"
) as HTMLDivElement;
const settingsBtn = document.getElementById(
  "settings-btn"
) as HTMLButtonElement;
const notification = document.getElementById("notification") as HTMLDivElement;
const notificationMessage = document.getElementById(
  "notification-message"
) as HTMLSpanElement;
const notificationClose = document.getElementById(
  "notification-close"
) as HTMLButtonElement;
const columnSelectModal = document.getElementById(
  "column-select-modal"
) as HTMLDivElement;
const columnOptions = document.getElementById(
  "column-options"
) as HTMLDivElement;
const cancelColumnSelect = document.getElementById(
  "cancel-column-select"
) as HTMLButtonElement;

// Initialize popup
async function initPopup() {
  try {
    // Load workspaces
    await loadWorkspaces();

    // Load recent bookmarks
    await loadRecentBookmarks();

    // Add event listeners
    addEventListeners();
  } catch (error) {
    showNotification(
      `Error initializing: ${(error as Error).message}`,
      "error"
    );
  }
}

// Load workspaces
async function loadWorkspaces() {
  try {
    const workspaces = await storageService.getWorkspaces();
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId = workspaceSettings.lastVisitedWorkspaceId;

    // Clear loading placeholder
    workspacesList.innerHTML = "";

    // Create workspace items
    Object.values(workspaces).forEach((workspace: Workspace) => {
      const workspaceItem = document.createElement("div");
      workspaceItem.className = `workspace-item ${
        workspace.id === activeWorkspaceId ? "active" : ""
      }`;
      workspaceItem.textContent = workspace.name;
      workspaceItem.dataset.id = workspace.id;

      // Add click event to switch workspace
      workspaceItem.addEventListener("click", () =>
        switchWorkspace(workspace.id)
      );

      workspacesList.appendChild(workspaceItem);
    });
  } catch (error) {
    workspacesList.innerHTML = `<div class="workspace-error">Error loading workspaces</div>`;
    console.error("Error loading workspaces:", error);
  }
}

// Load recent bookmarks
async function loadRecentBookmarks() {
  try {
    const recentBookmarks = await analyticsService.getRecentlyUsedBookmarks(5);

    // Clear loading placeholder
    recentBookmarksList.innerHTML = "";

    if (recentBookmarks.length === 0) {
      recentBookmarksList.innerHTML =
        '<div class="no-bookmarks">No recent bookmarks</div>';
      return;
    }

    // Create bookmark items
    recentBookmarks.forEach((bookmark: Bookmark) => {
      const bookmarkItem = document.createElement("div");
      bookmarkItem.className = "bookmark-item";
      bookmarkItem.dataset.id = bookmark.id;
      bookmarkItem.dataset.url = bookmark.url;

      // Create favicon element
      const favicon = document.createElement("img");
      favicon.className = "bookmark-favicon";
      favicon.src = bookmark.favicon || "../assets/images/default-favicon.png";
      favicon.alt = "";

      // Create bookmark info container
      const bookmarkInfo = document.createElement("div");
      bookmarkInfo.className = "bookmark-info";

      // Create title element
      const title = document.createElement("div");
      title.className = "bookmark-title";
      title.textContent = bookmark.title;

      // Create URL element
      const url = document.createElement("div");
      url.className = "bookmark-url";
      url.textContent = bookmark.url;

      // Append elements
      bookmarkInfo.appendChild(title);
      bookmarkInfo.appendChild(url);

      bookmarkItem.appendChild(favicon);
      bookmarkItem.appendChild(bookmarkInfo);

      // Add click event to open bookmark
      bookmarkItem.addEventListener("click", () =>
        openBookmark(bookmark.id, bookmark.url)
      );

      recentBookmarksList.appendChild(bookmarkItem);
    });
  } catch (error) {
    recentBookmarksList.innerHTML = `<div class="bookmarks-error">Error loading bookmarks</div>`;
    console.error("Error loading recent bookmarks:", error);
  }
}

// Switch active workspace
async function switchWorkspace(workspaceId: string) {
  try {
    // Update workspace settings
    await storageService.updateWorkspaceSettings({
      lastVisitedWorkspaceId: workspaceId,
    });

    // Update UI
    const workspaceItems = workspacesList.querySelectorAll(".workspace-item");
    workspaceItems.forEach((item) => {
      if (item.getAttribute("data-id") === workspaceId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    showNotification("Workspace switched successfully", "success");
  } catch (error) {
    showNotification(
      `Error switching workspace: ${(error as Error).message}`,
      "error"
    );
  }
}

// Open bookmark in new tab
function openBookmark(bookmarkId: string, url: string) {
  chrome.runtime.sendMessage(
    { type: "OPEN_BOOKMARK", bookmarkId, url },
    (response) => {
      if (!response.success) {
        showNotification(`Error opening bookmark: ${response.error}`, "error");
      }
    }
  );
}

// Add current page as bookmark
async function addCurrentPage() {
  try {
    // Get active workspace first
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId = workspaceSettings.lastVisitedWorkspaceId;

    if (!activeWorkspaceId) {
      showNotification("No active workspace found", "error");
      return;
    }

    // Get columns for the active workspace
    const columns = await storageService.getColumns(activeWorkspaceId);

    // Check if columns exist
    if (!columns || Object.keys(columns).length === 0) {
      showNotification("No columns found in the active workspace", "error");
      return;
    }

    // If only one column exists, add directly to that column
    if (Object.keys(columns).length === 1) {
      addBookmarkToColumn(Object.keys(columns)[0]);
      return;
    }

    // If multiple columns exist, show the column selection modal
    showColumnSelectionModal(columns);
  } catch (error) {
    showNotification(`Error: ${(error as Error).message}`, "error");
  }
}

function addBookmarkToColumn(columnId: string) {
  chrome.runtime.sendMessage(
    {
      type: "ADD_CURRENT_PAGE",
      columnId: columnId,
      workspaceId: storageService.getActiveWorkspaceId(), // Add workspace ID to the message
    },
    (response) => {
      if (response.success) {
        showNotification("Page added to bookmarks", "success");
        hideColumnSelectionModal();
      } else {
        showNotification(`Error adding bookmark: ${response.error}`, "error");
      }
    }
  );
}

function showColumnSelectionModal(columns: Record<string, any>) {
  // Clear previous options
  columnOptions.innerHTML = "";

  // Create column options
  Object.entries(columns).forEach(([columnId, column]) => {
    const option = document.createElement("button");
    option.className = "column-option";
    option.textContent = column.title || "Unnamed Column";
    console.log({ columnId, column });
    option.addEventListener("click", () => {
      addBookmarkToColumn(columnId);
    });
    columnOptions.appendChild(option);
  });

  // Show modal
  columnSelectModal.classList.remove("hidden");
}

function hideColumnSelectionModal() {
  columnSelectModal.classList.add("hidden");
}

// Show Kanban board
function showKanbanBoard() {
  chrome.tabs.create({ url: "kanban.html" });
}

// Show settings page
function showSettings() {
  chrome.tabs.create({ url: "settings.html" });
}

// Show notification
function showNotification(
  message: string,
  type: "success" | "error" | "warning" = "success"
) {
  notificationMessage.textContent = message;
  notification.className = `notification ${type}`;

  // Remove hidden class
  notification.classList.remove("hidden");

  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.classList.add("hidden");
  }, 3000);
}

// Add event listeners
function addEventListeners() {
  // Show Kanban board
  showKanbanBtn.addEventListener("click", showKanbanBoard);

  // Add current page as bookmark
  addBookmarkBtn.addEventListener("click", addCurrentPage);

  // Show settings
  settingsBtn.addEventListener("click", showSettings);

  // Close notification
  notificationClose.addEventListener("click", () => {
    notification.classList.add("hidden");
  });

  // Cancel column selection
  cancelColumnSelect.addEventListener("click", hideColumnSelectionModal);
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", initPopup);
