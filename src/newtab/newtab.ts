import "./newtab.css";
import { Bookmark } from "../models/bookmark";
import { Workspace } from "../models/workspace";
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

// Search elements
const searchBtn = document.getElementById("search-btn") as HTMLButtonElement;
const searchModal = document.getElementById("search-modal") as HTMLDivElement;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const searchCloseBtn = document.getElementById(
  "search-close-btn"
) as HTMLButtonElement;
const searchResults = document.getElementById(
  "search-results"
) as HTMLDivElement;

const workspaceSelector = document.getElementById(
  "workspace-selector"
) as HTMLDivElement;

const modalBookmarksList = document.getElementById(
  "modal-bookmarks-list"
) as HTMLDivElement;

// Note button
const noteBtn = document.getElementById("note-btn") as HTMLButtonElement;
if (noteBtn) {
  noteBtn.addEventListener("click", () => {
    openOrFocusTab("note.html");
  });
}

// Add/update these variables in your state
let selectedWorkspaceId: string = "";
let workspacesWithDefaults: Record<string, { name: string; count: number }> =
  {};

// State
let bookmarks: Record<string, Bookmark> = {};
let workspaces: Record<string, Workspace> = {};
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

    // Apply placeholder gradient immediately for instant visual feedback
    document.body.style.background = 'linear-gradient(-45deg, #1e2235, #2a2a3c, #0f172a, #1e293b)';
    document.body.style.backgroundSize = '400% 400%';

    // Then load background image
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

/**
 * Update the existing loadWorkspaceInfo function to check for default opens in any workspace
 */
async function loadWorkspaceInfo(): Promise<void> {
  try {
    // Get workspace settings
    const workspaceSettings = await storageService.getWorkspaceSettings();
    const activeWorkspaceId =
      workspaceSettings?.lastVisitedWorkspaceId || "default";

    // Get workspace info
    workspaces = await storageService.getWorkspaces();
    const activeWorkspace = workspaces[activeWorkspaceId];

    if (activeWorkspace) {
      // Update workspace name
      if (activeWorkspaceName) {
        activeWorkspaceName.textContent = activeWorkspace.name;
      }

      // Check all workspaces for default opens
      let anyWorkspaceHasDefaults = false;

      for (const workspaceId in workspaces) {
        const defaultOpens = await storageService.getDefaultOpens(workspaceId);
        if (defaultOpens.length > 0) {
          anyWorkspaceHasDefaults = true;
          break; // We found at least one workspace with defaults, no need to check the rest
        }
      }

      // Show/hide open all container based on whether any workspace has default opens
      if (openAllContainer) {
        if (anyWorkspaceHasDefaults) {
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
  // Try to get cached image first
  const cachedImage = localStorage.getItem('markzen-last-background');
  if (cachedImage && navigator.onLine) {
    // Use cached image immediately
    document.body.style.backgroundImage = `url(${cachedImage})`;

    // Get the corresponding background image info for photo credit
    try {
      const cachedImageInfo = JSON.parse(localStorage.getItem('markzen-last-background-info') || '{}');
      if (cachedImageInfo.photographer && cachedImageInfo.profileUrl) {
        currentBackgroundImage = cachedImageInfo;
        renderPhotoCredit();
      }
    } catch (e) {
      console.warn('Could not parse cached image info', e);
    }

    // Then load a new image in the background for next time
    setTimeout(() => {
      loadNewBackgroundImage();
    }, 1000);
    return;
  }

  // No cached image or offline, load a new one
  loadNewBackgroundImage();
}

// Load a new background image with optimizations
function loadNewBackgroundImage() {
  // Check if offline
  if (!navigator.onLine) {
    console.log('Offline, using fallback gradient background');
    // Keep using the gradient background that was set in initNewTab
    return;
  }

  const randomIndex = Math.floor(Math.random() * backgroundImages.length);
  currentBackgroundImage = backgroundImages[randomIndex];

  if (currentBackgroundImage) {
    // Get viewport dimensions for appropriate sizing
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create optimized image URL with size parameters
    const optimizedUrl = `${currentBackgroundImage.url}?w=${width}&h=${height}&q=80&fm=webp&fit=crop`;

    // Create an image element to preload
    const img = new Image();
    img.onload = () => {
      // Once loaded, set as background
      document.body.style.backgroundImage = `url(${optimizedUrl})`;
      renderPhotoCredit();

      // Cache for next time
      try {
        localStorage.setItem('markzen-last-background', optimizedUrl);
        localStorage.setItem('markzen-last-background-info', JSON.stringify({
          url: currentBackgroundImage?.url,
          photographer: currentBackgroundImage?.photographer,
          profileUrl: currentBackgroundImage?.profileUrl
        }));
      } catch (e) {
        console.warn('Could not cache background image', e);
      }
    };

    img.onerror = () => {
      console.error('Failed to load background image:', optimizedUrl);
      // Keep the gradient background on error
    };

    // Start loading the image
    img.src = optimizedUrl;
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
  // Get workspaces (needed for search)
  workspaces = await storageService.getWorkspaces();
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

// Replace the openBookmark function in newtab.ts with this improved version:

// Open bookmark in new tab
function openBookmark(bookmarkId: string, url: string) {
  console.log("Opening bookmark:", bookmarkId, url);

  // Direct approach to open tab without background service worker
  function openTabDirectly(url: string) {
    console.log("Opening URL directly:", url);
    chrome.tabs.create({ url });

    // Still try to track analytics if possible
    try {
      analyticsService.trackBookmarkClick(bookmarkId).catch((err) => {
        console.warn("Could not track bookmark click:", err);
      });
    } catch (error) {
      console.warn("Error tracking bookmark click:", error);
    }
  }

  try {
    // First try sending a message to the background service worker
    chrome.runtime.sendMessage(
      { type: "OPEN_BOOKMARK", bookmarkId, url },
      (response) => {
        // Check for runtime error
        if (chrome.runtime.lastError) {
          console.warn(
            "Chrome runtime error:",
            chrome.runtime.lastError.message
          );
          openTabDirectly(url);
          return;
        }

        // Check if response is undefined
        if (!response) {
          console.warn(
            "No response from background service worker, opening directly"
          );
          openTabDirectly(url);
          return;
        }

        if (!response.success) {
          console.error("Error from background service:", response.error);
          openTabDirectly(url);
        }
      }
    );
  } catch (error) {
    console.error("Exception opening bookmark:", error);
    openTabDirectly(url);
  }
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

// Update the updateWorkspaceSelection function to track if bookmarks were already rendered
let lastRenderedWorkspaceId = "";

async function updateWorkspaceSelection(workspaceId: string): Promise<void> {
  // Don't re-render if this is the same workspace that was just rendered
  if (workspaceId === lastRenderedWorkspaceId) {
    return;
  }

  // Update selected workspace ID
  selectedWorkspaceId = workspaceId;

  // Update default opens count
  updateDefaultOpensCount();

  // Clear previous bookmarks
  if (modalBookmarksList) {
    modalBookmarksList.innerHTML = "";
  }

  // Render bookmarks for the selected workspace
  await renderWorkspaceBookmarks(workspaceId);

  // Update the last rendered workspace ID
  lastRenderedWorkspaceId = workspaceId;
}

// Add this new function to render the bookmarks
async function renderWorkspaceBookmarks(workspaceId: string): Promise<void> {
  if (!modalBookmarksList) return;

  // Clear previous bookmarks
  modalBookmarksList.innerHTML = "";

  try {
    // Get default opens for the selected workspace
    const defaultOpens = await storageService.getDefaultOpens(workspaceId);

    if (defaultOpens.length === 0) {
      modalBookmarksList.innerHTML = `<div class="modal-no-bookmarks">No default bookmarks in this workspace</div>`;
      return;
    }

    // Create bookmark items
    defaultOpens.forEach((bookmark) => {
      const bookmarkItem = document.createElement("div");
      bookmarkItem.className = "modal-bookmark-item";

      // Create favicon
      const favicon = document.createElement("img");
      favicon.className = "modal-bookmark-favicon";
      favicon.src = bookmark.favicon || "../assets/images/default-favicon.png";
      favicon.alt = "";

      // Create title
      const title = document.createElement("div");
      title.className = "modal-bookmark-title";
      title.textContent = bookmark.title;
      title.title = bookmark.title; // Add tooltip with full title

      // Append elements to bookmark item
      bookmarkItem.appendChild(favicon);
      bookmarkItem.appendChild(title);

      // Add to bookmarks list
      modalBookmarksList.appendChild(bookmarkItem);
    });
  } catch (error) {
    console.error("Error loading workspace bookmarks:", error);
    modalBookmarksList.innerHTML = `<div class="modal-error">Error loading bookmarks</div>`;
  }
}

/**
 * Handle opening all default bookmarks - Updated to show workspaces
 */
async function handleOpenAllDefaults(): Promise<void> {
  try {
    // Get workspace settings for the active workspace
    const workspaceSettings = await storageService.getWorkspaceSettings();
    selectedWorkspaceId =
      workspaceSettings?.lastVisitedWorkspaceId || "default";

    // Load all workspaces
    workspaces = await storageService.getWorkspaces();

    // Get default opens for each workspace and populate workspacesWithDefaults
    workspacesWithDefaults = {};

    for (const workspaceId in workspaces) {
      const defaultOpens = await storageService.getDefaultOpens(workspaceId);
      if (defaultOpens.length > 0) {
        workspacesWithDefaults[workspaceId] = {
          name: workspaces[workspaceId].name,
          count: defaultOpens.length,
        };
      }
    }

    // If no workspaces have default opens, show notification and return
    if (Object.keys(workspacesWithDefaults).length === 0) {
      showNotification(
        "No default bookmarks found in any workspace",
        "warning"
      );
      return;
    }

    // Render workspace selector
    renderWorkspaceSelector();

    // Update default opens count for the selected workspace
    updateDefaultOpensCount();

    // Render the bookmarks for the initially selected workspace
    // Clear previous bookmarks first to prevent duplicates
    if (modalBookmarksList) {
      modalBookmarksList.innerHTML = "";
    }

    await renderWorkspaceBookmarks(selectedWorkspaceId);

    // Show modal
    openDefaultsModal.classList.add("active");
  } catch (error) {
    console.error("Error preparing default opens:", error);
    showNotification(
      `Error loading workspaces: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Render workspace selector in the modal
 */
function renderWorkspaceSelector(): void {
  // Clear previous content
  workspaceSelector.innerHTML = "";

  // Create a workspace option for each workspace with default opens
  Object.entries(workspacesWithDefaults).forEach(
    ([workspaceId, workspaceInfo]) => {
      const workspaceOption = document.createElement("div");
      workspaceOption.className = "workspace-option";
      workspaceOption.dataset.id = workspaceId;

      // Add selected class if this is the active workspace
      if (workspaceId === selectedWorkspaceId) {
        workspaceOption.classList.add("selected");
      }

      // Create name element
      const nameDiv = document.createElement("div");
      nameDiv.className = "workspace-name";
      nameDiv.textContent = workspaceInfo.name;

      // Create count element
      const countDiv = document.createElement("div");
      countDiv.className = "workspace-count";
      countDiv.textContent = workspaceInfo.count.toString();

      // Append elements to workspace option
      workspaceOption.appendChild(nameDiv);
      workspaceOption.appendChild(countDiv);

      // Add click event
      workspaceOption.addEventListener("click", async () => {
        // Remove selected class from all options
        document.querySelectorAll(".workspace-option").forEach((option) => {
          option.classList.remove("selected");
        });

        // Add selected class to this option
        workspaceOption.classList.add("selected");

        // Update selected workspace ID
        // Get the workspace ID
        const clickedWorkspaceId = workspaceOption.dataset.id;
        if (clickedWorkspaceId) {
          // Update workspace selection
          await updateWorkspaceSelection(clickedWorkspaceId);
        }
      });

      workspaceSelector.appendChild(workspaceOption);
    }
  );
}

/**
 * Update default opens count in the modal
 */
function updateDefaultOpensCount(): void {
  if (modalDefaultOpensCount) {
    const count = workspacesWithDefaults[selectedWorkspaceId]?.count || 0;
    modalDefaultOpensCount.textContent = count.toString();
  }
}

/**
 * Open all default bookmarks in current window - Updated to use selected workspace
 */
async function openDefaultsInCurrentWindow() {
  try {
    await storageService.openDefaultBookmarks(selectedWorkspaceId, false);
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
 * Open all default bookmarks in new window - Updated to use selected workspace
 */
async function openDefaultsInNewWindow() {
  try {
    await storageService.openDefaultBookmarks(selectedWorkspaceId, true);
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
 * Open the search modal
 */
function openSearchModal(): void {
  searchModal.classList.add("active");
  searchInput.focus();
}

/**
 * Close the search modal
 */
function closeSearchModal(): void {
  searchModal.classList.remove("active");
  searchInput.value = "";
  searchResults.innerHTML = `
    <div class="search-empty">
      <p>Type to search across all workspaces</p>
    </div>
  `;
}

/**
 * Debounce function to prevent too many searches while typing
 */
function debounce<F extends (...args: any[]) => any>(
  func: F,
  delay: number
): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<F>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

/**
 * Handle search input changes
 */
async function handleSearch(): Promise<void> {
  const query = searchInput.value.trim().toLowerCase();

  if (query.length < 1) {
    searchResults.innerHTML = `
      <div class="search-empty">
        <p>Type to search across all workspaces</p>
      </div>
    `;
    return;
  }

  try {
    // Search in all bookmarks across all workspaces
    const results = await performSearch(query);
    displaySearchResults(results, query);
  } catch (error) {
    console.error("Error searching bookmarks:", error);
    searchResults.innerHTML = `
      <div class="search-empty">
        <p>Error searching bookmarks</p>
      </div>
    `;
  }
}

/**
 * Perform the search
 */
async function performSearch(
  query: string
): Promise<Array<Bookmark & { workspaceName: string }>> {
  // Filter bookmarks that match the query
  const filteredBookmarks = Object.values(bookmarks).filter((bookmark) => {
    const titleMatch = bookmark.title.toLowerCase().includes(query);
    const urlMatch = bookmark.url.toLowerCase().includes(query);
    return titleMatch || urlMatch;
  });

  // Sort by relevance (title matches first, then URL matches)
  filteredBookmarks.sort((a, b) => {
    const aTitleMatch = a.title.toLowerCase().includes(query);
    const bTitleMatch = b.title.toLowerCase().includes(query);

    if (aTitleMatch && !bTitleMatch) return -1;
    if (!aTitleMatch && bTitleMatch) return 1;

    // If both match in the same way, sort alphabetically
    return a.title.localeCompare(b.title);
  });

  // Add workspace names to results
  return filteredBookmarks
    .map((bookmark) => ({
      ...bookmark,
      workspaceName: workspaces[bookmark.workspaceId]?.name || "Unknown",
    }))
    .slice(0, 10); // Limit to 10 results to keep it fast and clean
}

/**
 * Highlight matching text
 */
function highlightMatch(text: string, query: string): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (!lowerText.includes(lowerQuery)) {
    return text;
  }

  const index = lowerText.indexOf(lowerQuery);
  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);

  return `${before}<span class="highlight">${match}</span>${after}`;
}

/**
 * Display search results
 */
function displaySearchResults(
  results: Array<Bookmark & { workspaceName: string }>,
  query: string
): void {
  if (results.length === 0) {
    searchResults.innerHTML = `
      <div class="search-empty">
        <p>No bookmarks found matching "${query}"</p>
      </div>
    `;
    return;
  }

  let html = "";

  results.forEach((bookmark) => {
    // Highlight matching text in title and URL
    const highlightedTitle = highlightMatch(bookmark.title, query);
    const highlightedUrl = highlightMatch(bookmark.url, query);

    html += `
      <div class="search-result-item" data-id="${bookmark.id}" data-url="${
      bookmark.url
    }">
        <img class="search-result-favicon" src="${
          bookmark.favicon || "../assets/images/default-favicon.png"
        }" alt="">
        <div class="search-result-info">
          <div class="search-result-title">${highlightedTitle}</div>
          <div class="search-result-url">${highlightedUrl}</div>
        </div>
        <div class="search-result-workspace">${bookmark.workspaceName}</div>
      </div>
    `;
  });

  searchResults.innerHTML = html;

  // Add click handlers to results
  document.querySelectorAll(".search-result-item").forEach((item) => {
    item.addEventListener("click", () => {
      const bookmarkId = item.getAttribute("data-id");
      const url = item.getAttribute("data-url");
      if (bookmarkId && url) {
        console.log("Search result clicked:", bookmarkId, url);
        // Close modal first
        closeSearchModal();
        // Then open bookmark - adding slight delay to ensure clean UI update
        setTimeout(() => {
          openBookmark(bookmarkId, url);
        }, 50);
      }
    });
  });
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

  // Add event listeners for default opens
  if (openAllDefaultsBtn) {
    openAllDefaultsBtn.addEventListener("click", handleOpenAllDefaults);
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () =>
      openDefaultsModal.classList.remove("active")
    );
  }

  if (openDefaultsCancelBtn) {
    openDefaultsCancelBtn.addEventListener("click", () =>
      openDefaultsModal.classList.remove("active")
    );
  }

  if (openDefaultsSameWindowBtn) {
    openDefaultsSameWindowBtn.addEventListener(
      "click",
      openDefaultsInCurrentWindow
    );
  }

  if (openDefaultsNewWindowBtn) {
    openDefaultsNewWindowBtn.addEventListener("click", openDefaultsInNewWindow);
  }

  // Add search event listeners
  if (searchBtn) {
    searchBtn.addEventListener("click", openSearchModal);
  }

  if (searchCloseBtn) {
    searchCloseBtn.addEventListener("click", closeSearchModal);
  }

  if (searchInput) {
    searchInput.addEventListener("input", debounce(handleSearch, 300));
  }

  // Close modal when clicking outside
  if (searchModal) {
    searchModal.addEventListener("click", function (e) {
      if (e.target === searchModal) {
        closeSearchModal();
      }
    });
  }

  // Close modal with Escape key
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Escape" &&
      searchModal &&
      searchModal.classList.contains("active")
    ) {
      closeSearchModal();
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initNewTab);
