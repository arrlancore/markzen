import "./popup.css";
import "../utils/storage";
import { Workspace } from "../models/workspace";
import { Bookmark } from "../models/bookmark";
import storageService from "../utils/storage";
import analyticsService from "../utils/analytics";
import themeService from "@/utils/theme-service";

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

// Add new interface for bookmark data
interface NewBookmarkData {
  title: string;
  url: string;
  favicon?: string;
}

// Add new function to get current page data
async function getCurrentPageData(): Promise<NewBookmarkData> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      resolve({
        title: currentTab.title || "",
        url: currentTab.url || "",
        favicon: currentTab.favIconUrl,
      });
    });
  });
}

// Initialize popup
async function initPopup() {
  try {
    await themeService.applyThemeFromSettings();
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
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId = workspaceSettings.lastVisitedWorkspaceId;

    if (!activeWorkspaceId) {
      showNotification("No active workspace found", "error");
      return;
    }

    const columns = await storageService.getColumns(activeWorkspaceId);

    if (!columns || Object.keys(columns).length === 0) {
      showNotification("No columns found in the active workspace", "error");
      return;
    }

    // Get current page data
    const pageData = await getCurrentPageData();

    // Show the bookmark modal
    showBookmarkModal(pageData, columns);
  } catch (error) {
    showNotification(`Error: ${(error as Error).message}`, "error");
  }
}

function showBookmarkModal(
  pageData: NewBookmarkData,
  columns: Record<string, any>
) {
  // Check if modal already exists and remove it
  const existingModal = document.querySelector(".bookmark-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.className = "bookmark-modal";
  modal.innerHTML = `
    <div class="bookmark-modal-content">
      <h3 class="modal-title">Add Bookmark</h3>
      
      <div class="form-group">
        <label for="bookmark-title" class="form-label">Title *</label>
        <input 
          type="text" 
          id="bookmark-title" 
          class="form-input"
          value="${pageData.title}" 
          placeholder="Enter bookmark title"
          required
        >
      </div>

      ${
        Object.keys(columns).length > 1
          ? `
        <div class="form-group">
          <label class="form-label">Select Column *</label>
          <div class="column-options" id="modal-column-options">
            ${Object.entries(columns)
              .map(
                ([columnId, column]) => `
                <button class="column-option" data-column-id="${columnId}">
                  ${column.title || "Unnamed Column"}
                </button>
              `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }
      
      <div class="modal-actions">
        <button id="cancel-bookmark" class="btn btn-secondary">Cancel</button>
        <button id="save-bookmark" class="btn btn-primary">Add Bookmark</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const titleInput = modal.querySelector("#bookmark-title") as HTMLInputElement;
  const cancelBtn = modal.querySelector(
    "#cancel-bookmark"
  ) as HTMLButtonElement;
  const saveBtn = modal.querySelector("#save-bookmark") as HTMLButtonElement;

  cancelBtn.addEventListener("click", () => {
    const modals = document.querySelectorAll(".bookmark-modal");
    modals.forEach((modal) => modal.remove());
  });

  saveBtn.addEventListener("click", () => {
    const newTitle = titleInput.value.trim();
    if (!newTitle) {
      showNotification("Title cannot be empty", "error");
      return;
    }

    const columnId =
      Object.keys(columns).length === 1
        ? Object.keys(columns)[0]
        : (modal.querySelector(".column-option.selected") as HTMLElement)
            ?.dataset.columnId;

    if (!columnId) {
      showNotification("Please select a column", "error");
      return;
    }

    addBookmarkToColumnWithTitle(columnId, newTitle, pageData);
    const modals = document.querySelectorAll(".bookmark-modal");
    modals.forEach((modal) => modal.remove());
  });

  // If multiple columns, add selection handling
  if (Object.keys(columns).length > 1) {
    const columnOptions = modal.querySelectorAll(".column-option");
    columnOptions.forEach((option) => {
      option.addEventListener("click", () => {
        columnOptions.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
      });
    });
  }
}

function addBookmarkToColumnWithTitle(
  columnId: string,
  title: string,
  pageData: NewBookmarkData
) {
  chrome.runtime.sendMessage(
    {
      type: "ADD_CURRENT_PAGE",
      columnId: columnId,
      workspaceId: storageService.getActiveWorkspaceId(),
      customTitle: title,
      url: pageData.url,
      favicon: pageData.favicon,
    },
    (response) => {
      if (response.success) {
        showNotification("Bookmark added successfully", "success");
      } else {
        showNotification(`Error adding bookmark: ${response.error}`, "error");
      }
    }
  );
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
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", initPopup);
