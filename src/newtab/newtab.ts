import "./newtab.css";
import { Workspace } from "../models/workspace";
import { Bookmark, Column } from "../models/bookmark";
import storageService from "../utils/storage";
import analyticsService from "../utils/analytics";
import { format } from "date-fns";

// Background images (these would normally be stored in the extension)
const backgroundImages = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
  "https://images.unsplash.com/photo-1511300636408-a63a89df3482",
  "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5",
  "https://images.unsplash.com/photo-1506259091721-347e791bab0f",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa",
];

// DOM Elements
const workspaceSelect = document.getElementById(
  "workspace-select"
) as HTMLSelectElement;
const showKanbanBtn = document.getElementById(
  "show-kanban-btn"
) as HTMLButtonElement;
const addBookmarkBtn = document.getElementById(
  "add-bookmark-btn"
) as HTMLButtonElement;
const settingsBtn = document.getElementById(
  "settings-btn"
) as HTMLButtonElement;
const clockElement = document.getElementById("clock") as HTMLDivElement;
const dateElement = document.getElementById("date") as HTMLDivElement;
const topBookmarksList = document.getElementById(
  "top-bookmarks-list"
) as HTMLDivElement;
const workspaceColumns = document.getElementById(
  "workspace-columns"
) as HTMLDivElement;

// State
let activeWorkspaceId: string = "default";
let workspaces: Record<string, Workspace> = {};
let columns: Record<string, Column> = {};
let bookmarks: Record<string, Bookmark> = {};

// Initialize new tab page
async function initNewTab() {
  try {
    // Set random background
    setRandomBackground();

    // Update clock
    updateClock();
    setInterval(updateClock, 1000);

    // Load data
    await loadData();

    // Render UI
    renderWorkspaceSelector();
    renderTopBookmarks();
    renderWorkspacePreview();

    // Add event listeners
    addEventListeners();
  } catch (error) {
    console.error("Error initializing new tab:", error);
  }
}

// Set random background image
function setRandomBackground() {
  const randomIndex = Math.floor(Math.random() * backgroundImages.length);
  const imageUrl = backgroundImages[randomIndex];
  document.body.style.backgroundImage = `url(${imageUrl})`;
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
  // Get settings
  const settings = await storageService.getSettings();

  // Get workspace settings
  const workspaceSettings = await storageService.getWorkspaceSettings();
  activeWorkspaceId = workspaceSettings.lastVisitedWorkspaceId;

  // Get workspaces
  workspaces = await storageService.getWorkspaces();

  // Get columns
  columns = await storageService.getColumns();

  // Get bookmarks
  bookmarks = await storageService.getBookmarks();
}

// Render workspace selector
function renderWorkspaceSelector() {
  // Clear previous options
  workspaceSelect.innerHTML = "";

  // Add options for each workspace
  Object.values(workspaces).forEach((workspace) => {
    const option = document.createElement("option");
    option.value = workspace.id;
    option.textContent = workspace.name;
    option.selected = workspace.id === activeWorkspaceId;

    workspaceSelect.appendChild(option);
  });
}

// Render top bookmarks
async function renderTopBookmarks() {
  try {
    // Get top bookmarks
    const topBookmarks = await analyticsService.getMostUsedBookmarks(10);

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

      // Create header with favicon and title
      const header = document.createElement("div");
      header.className = "bookmark-header";

      const favicon = document.createElement("img");
      favicon.className = "bookmark-favicon";
      favicon.src = bookmark.favicon || "../assets/images/default-favicon.png";
      favicon.alt = "";

      const title = document.createElement("div");
      title.className = "bookmark-title";
      title.textContent = bookmark.title;

      header.appendChild(favicon);
      header.appendChild(title);

      // Create URL element
      const url = document.createElement("div");
      url.className = "bookmark-url";
      url.textContent = bookmark.url;

      // Create usage info
      const usage = document.createElement("div");
      usage.className = "bookmark-usage";
      usage.textContent = `Used ${clicks} ${clicks === 1 ? "time" : "times"}`;

      // Add elements to card
      bookmarkCard.appendChild(header);
      bookmarkCard.appendChild(url);
      bookmarkCard.appendChild(usage);

      // Add click event
      bookmarkCard.addEventListener("click", () => {
        openBookmark(bookmark.id, bookmark.url);
      });

      topBookmarksList.appendChild(bookmarkCard);
    });
  } catch (error) {
    console.error("Error rendering top bookmarks:", error);
    topBookmarksList.innerHTML =
      '<div class="bookmarks-error">Error loading bookmarks</div>';
  }
}

// Render workspace preview
function renderWorkspacePreview() {
  try {
    // Clear previous columns
    workspaceColumns.innerHTML = "";

    // Get columns for active workspace
    const workspaceColumnsList = Object.values(columns)
      .filter((column) => column.workspaceId === activeWorkspaceId)
      .sort((a, b) => a.order - b.order);

    // If no columns, show message
    if (workspaceColumnsList.length === 0) {
      workspaceColumns.innerHTML =
        '<div class="no-columns">No columns in this workspace</div>';
      return;
    }

    // Add column cards
    workspaceColumnsList.forEach((column) => {
      const columnCard = document.createElement("div");
      columnCard.className = "column-card";

      // Create column header
      const header = document.createElement("div");
      header.className = "column-header";
      header.textContent = column.title;

      // Create bookmarks container
      const bookmarksContainer = document.createElement("div");
      bookmarksContainer.className = "column-bookmarks";

      // Get bookmarks for this column
      const columnBookmarks = column.bookmarkIds
        .map((id) => bookmarks[id])
        .filter((bookmark) => bookmark !== undefined);

      // If no bookmarks, show message
      if (columnBookmarks.length === 0) {
        const noBookmarks = document.createElement("div");
        noBookmarks.className = "no-column-bookmarks";
        noBookmarks.textContent = "No bookmarks";
        bookmarksContainer.appendChild(noBookmarks);
      } else {
        // Add bookmark elements (limited to 5)
        columnBookmarks.slice(0, 5).forEach((bookmark) => {
          const bookmarkElement = document.createElement("div");
          bookmarkElement.className = "column-bookmark";
          bookmarkElement.dataset.id = bookmark.id;
          bookmarkElement.dataset.url = bookmark.url;

          // Create favicon element
          const favicon = document.createElement("img");
          favicon.className = "bookmark-favicon";
          favicon.src =
            bookmark.favicon || "../assets/images/default-favicon.png";
          favicon.alt = "";

          // Create title element
          const title = document.createElement("div");
          title.className = "column-bookmark-title";
          title.textContent = bookmark.title;

          // Add elements to bookmark
          bookmarkElement.appendChild(favicon);
          bookmarkElement.appendChild(title);

          // Add click event
          bookmarkElement.addEventListener("click", () => {
            openBookmark(bookmark.id, bookmark.url);
          });

          bookmarksContainer.appendChild(bookmarkElement);
        });

        // If there are more bookmarks, show a message
        if (columnBookmarks.length > 5) {
          const moreBookmarks = document.createElement("div");
          moreBookmarks.className = "more-bookmarks";
          moreBookmarks.textContent = `+ ${columnBookmarks.length - 5} more`;
          bookmarksContainer.appendChild(moreBookmarks);
        }
      }

      // Add elements to column card
      columnCard.appendChild(header);
      columnCard.appendChild(bookmarksContainer);

      workspaceColumns.appendChild(columnCard);
    });
  } catch (error) {
    console.error("Error rendering workspace preview:", error);
    workspaceColumns.innerHTML =
      '<div class="workspace-error">Error loading workspace</div>';
  }
}

// Switch workspace
async function switchWorkspace(workspaceId: string) {
  try {
    // Update active workspace
    activeWorkspaceId = workspaceId;

    // Update workspace settings
    await storageService.updateWorkspaceSettings({
      lastVisitedWorkspaceId: workspaceId,
    });

    // Re-render workspace preview
    renderWorkspacePreview();
  } catch (error) {
    console.error("Error switching workspace:", error);
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

// Add current page as bookmark
function addCurrentPage() {
  chrome.runtime.sendMessage({ type: "ADD_CURRENT_PAGE" }, (response) => {
    if (response.success) {
      // Reload data and re-render
      loadData().then(() => {
        renderWorkspacePreview();
        renderTopBookmarks();
      });
    } else {
      console.error("Error adding bookmark:", response.error);
    }
  });
}

// Show Kanban board
function showKanbanBoard() {
  chrome.tabs.create({ url: "kanban.html" });
}

// Show settings page
function showSettings() {
  chrome.tabs.create({ url: "settings.html" });
}

// Add event listeners
function addEventListeners() {
  // Workspace selector change
  workspaceSelect.addEventListener("change", () => {
    switchWorkspace(workspaceSelect.value);
  });

  // Show Kanban board
  showKanbanBtn.addEventListener("click", showKanbanBoard);

  // Add current page as bookmark
  addBookmarkBtn.addEventListener("click", addCurrentPage);

  // Show settings
  settingsBtn.addEventListener("click", showSettings);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initNewTab);
