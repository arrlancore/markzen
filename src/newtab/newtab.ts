import "./newtab.css";
import { Bookmark } from "../models/bookmark";
import storageService from "../utils/storage";
import analyticsService from "../utils/analytics";
import { format } from "date-fns";
import backgroundImages from "./backgroundImages";
import themeService from "@/utils/theme-service";
import { openOrFocusTab } from "../utils/tab-utils";

// DOM Elements
const showKanbanBtn = document.getElementById(
  "show-kanban-btn"
) as HTMLButtonElement;
const settingsBtn = document.getElementById(
  "settings-btn"
) as HTMLButtonElement;
const clockElement = document.getElementById("clock") as HTMLDivElement;
const dateElement = document.getElementById("date") as HTMLDivElement;
const topBookmarksList = document.getElementById(
  "top-bookmarks-list"
) as HTMLDivElement;
const photoCreditElement = document.getElementById(
  "photo-credit"
) as HTMLDivElement;
// Add these new DOM Elements
const workspaceInfo = document.getElementById(
  "workspace-info"
) as HTMLDivElement;
const activeWorkspaceName = document.getElementById(
  "active-workspace-name"
) as HTMLSpanElement;
const openAllContainer = document.getElementById(
  "open-all-container"
) as HTMLDivElement;
const openAllDefaultsBtn = document.getElementById(
  "open-all-defaults-btn"
) as HTMLButtonElement;
const defaultOpensCount = document.getElementById(
  "default-opens-count"
) as HTMLSpanElement;

// Modal elements
const openDefaultsModal = document.getElementById(
  "open-defaults-modal"
) as HTMLDivElement;
const modalDefaultOpensCount = document.getElementById(
  "modal-default-opens-count"
) as HTMLSpanElement;
const modalWorkspaceName = document.getElementById(
  "modal-workspace-name"
) as HTMLSpanElement;
const closeModalBtn = document.getElementById(
  "close-modal-btn"
) as HTMLButtonElement;
const openDefaultsCancelBtn = document.getElementById(
  "open-defaults-cancel-btn"
) as HTMLButtonElement;
const openDefaultsSameWindowBtn = document.getElementById(
  "open-defaults-same-window-btn"
) as HTMLButtonElement;
const openDefaultsNewWindowBtn = document.getElementById(
  "open-defaults-new-window-btn"
) as HTMLButtonElement;

// State
let bookmarks: Record<string, Bookmark> = {};
let currentBackgroundImage: {
  url: string;
  photographer: string;
  profileUrl: string;
} | null = null;

// Initialize new tab page
async function initNewTab() {
  try {
    // Initialize storage service first
    await storageService.initialize();

    await themeService.applyThemeFromSettings();
    setRandomBackground();

    updateClock();
    setInterval(updateClock, 1000);

    await loadData();

    // Load workspace information and default opens
    await loadWorkspaceInfo();

    renderTopBookmarks();
    addEventListeners();
  } catch (error) {
    console.error("Error initializing new tab:", error);
  }
}

async function loadWorkspaceInfo(): Promise<void> {
  try {
    // Get workspace settings
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId =
      workspaceSettings?.lastVisitedWorkspaceId || "default";

    // Get workspace info
    const workspaces = await storageService.getWorkspaces();
    const activeWorkspace = workspaces[activeWorkspaceId];

    if (activeWorkspace) {
      // Update workspace name
      const activeWorkspaceName = document.getElementById(
        "active-workspace-name"
      );
      if (activeWorkspaceName) {
        activeWorkspaceName.textContent = activeWorkspace.name;
      }

      // Get default opens
      const defaultOpens = await storageService.getDefaultOpens(
        activeWorkspaceId
      );
      const count = defaultOpens.length;

      // Update count
      if (defaultOpensCount) {
        defaultOpensCount.textContent = count.toString();
      }

      // Show/hide open all container based on count
      if (openAllContainer) {
        if (count > 0) {
          openAllContainer.classList.remove("hidden");
        } else {
          openAllContainer.classList.add("hidden");
        }
      }
    }
  } catch (error) {
    console.error("Error loading workspace info:", error);
  }
}

// Set random background image
function setRandomBackground() {
  const randomIndex = Math.floor(Math.random() * backgroundImages.length);
  currentBackgroundImage = backgroundImages[randomIndex];

  if (currentBackgroundImage) {
    document.body.style.backgroundImage = `url(${currentBackgroundImage.url})`;
    renderPhotoCredit();
  }
}

// Render photo credit
function renderPhotoCredit() {
  if (currentBackgroundImage && photoCreditElement) {
    photoCreditElement.innerHTML = `Photo by <a href="${currentBackgroundImage.profileUrl}?utm_source=markzen&utm_medium=referral" target="_blank" rel="noopener noreferrer">${currentBackgroundImage.photographer}</a> on <a href="https://unsplash.com/?utm_source=markzen&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
  }
}

// Update clock and date
function updateClock() {
  const now = new Date();

  // Update time
  clockElement.textContent = format(now, "HH:mm");

  // Update date
  dateElement.textContent = format(now, "EEEE, MMMM d");
}

// Load data from storage
async function loadData() {
  // Get bookmarks
  bookmarks = await storageService.getBookmarks();
}

// Render top bookmarks (limited to 3)
async function renderTopBookmarks() {
  try {
    // Get top bookmarks (limited to 3)
    const topBookmarks = await analyticsService.getMostUsedBookmarks(3);

    // Clear previous bookmarks
    topBookmarksList.innerHTML = "";

    // If no bookmarks, show message
    if (topBookmarks.length === 0) {
      topBookmarksList.innerHTML =
        '<div class="no-bookmarks">No bookmarks yet</div>';
      return;
    }

    // Add bookmark cards
    topBookmarks.forEach(({ bookmark, clicks }) => {
      const bookmarkCard = document.createElement("div");
      bookmarkCard.className = "bookmark-card";
      bookmarkCard.dataset.id = bookmark.id;
      bookmarkCard.dataset.url = bookmark.url;

      // Create favicon
      const favicon = document.createElement("img");
      favicon.className = "bookmark-favicon";
      favicon.src = bookmark.favicon || "../assets/images/default-favicon.png";
      favicon.alt = "";

      // Create title element
      const title = document.createElement("div");
      title.className = "bookmark-title";
      title.textContent = bookmark.title;

      // Add elements to card
      bookmarkCard.appendChild(favicon);
      bookmarkCard.appendChild(title);

      // Add click event
      bookmarkCard.addEventListener("click", () => {
        openBookmark(bookmark.id, bookmark.url);
      });

      topBookmarksList.appendChild(bookmarkCard);
    });
  } catch (error) {
    console.error("Error rendering top bookmarks:", error);
    topBookmarksList.innerHTML =
      '<div class="no-bookmarks">Unable to load bookmarks</div>';
  }
}

// Open bookmark in new tab
function openBookmark(bookmarkId: string, url: string) {
  chrome.runtime.sendMessage(
    { type: "OPEN_BOOKMARK", bookmarkId, url },
    (response) => {
      if (!response.success) {
        console.error("Error opening bookmark:", response.error);
      }
    }
  );
}

// Show Kanban board
function showKanbanBoard() {
  openOrFocusTab("kanban.html");
}

// Show settings page
function showSettings() {
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
 * Handle opening all default bookmarks
 */
function handleOpenAllDefaults(): void {
  // Get count of default opens
  const count = parseInt(defaultOpensCount.textContent || "0", 10);

  if (count === 0) {
    showNotification("No default opens to open", "warning");
    return;
  }

  // Update modal content
  modalDefaultOpensCount.textContent = count.toString();

  // Set the workspace name in the modal
  if (modalWorkspaceName) {
    const activeWorkspaceName = document.getElementById(
      "active-workspace-name"
    );
    if (activeWorkspaceName) {
      modalWorkspaceName.textContent =
        activeWorkspaceName.textContent || "Default";
    }
  }

  // Show modal
  openDefaultsModal.classList.add("active");
}

/**
 * Open all default bookmarks in current window
 */
async function openDefaultsInCurrentWindow() {
  try {
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId =
      workspaceSettings?.lastVisitedWorkspaceId || "default";

    await storageService.openDefaultBookmarks(activeWorkspaceId, false);
    openDefaultsModal.classList.remove("active");
    showNotification("Opening default bookmarks", "success");
  } catch (error) {
    console.error(`Error opening default bookmarks: ${error}`);
    showNotification(
      `Error opening bookmarks: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Open all default bookmarks in new window
 */
async function openDefaultsInNewWindow() {
  try {
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId =
      workspaceSettings?.lastVisitedWorkspaceId || "default";

    await storageService.openDefaultBookmarks(activeWorkspaceId, true);
    openDefaultsModal.classList.remove("active");
    showNotification("Opening default bookmarks in new window", "success");
  } catch (error) {
    console.error(`Error opening default bookmarks: ${error}`);
    showNotification(
      `Error opening bookmarks: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Show a notification
 */
function showNotification(
  message: string,
  type: "success" | "error" | "warning" = "success"
): void {
  // Create a notification element if it doesn't exist
  let notification = document.getElementById("notification");

  if (!notification) {
    notification = document.createElement("div");
    notification.id = "notification";
    notification.className = "notification";

    const notificationMessage = document.createElement("span");
    notificationMessage.className = "notification-message";

    notification.appendChild(notificationMessage);
    document.body.appendChild(notification);
  }

  const notificationMessage = notification.querySelector(
    ".notification-message"
  );
  if (notificationMessage) {
    notificationMessage.textContent = message;
  }

  // Set the type
  notification.className = `notification ${type}`;

  // Show the notification
  notification.classList.remove("hidden");

  // Hide after 3 seconds
  setTimeout(() => {
    if (notification) {
      notification.classList.add("hidden");
    }
  }, 3000);
}

// Add event listeners
function addEventListeners() {
  // Existing event listeners
  showKanbanBtn.addEventListener("click", showKanbanBoard);
  settingsBtn.addEventListener("click", showSettings);

  // Add new event listeners for default opens
  openAllDefaultsBtn.addEventListener("click", handleOpenAllDefaults);
  closeModalBtn.addEventListener("click", () =>
    openDefaultsModal.classList.remove("active")
  );
  openDefaultsCancelBtn.addEventListener("click", () =>
    openDefaultsModal.classList.remove("active")
  );
  openDefaultsSameWindowBtn.addEventListener(
    "click",
    openDefaultsInCurrentWindow
  );
  openDefaultsNewWindowBtn.addEventListener("click", openDefaultsInNewWindow);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initNewTab);
