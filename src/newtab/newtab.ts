import "./newtab.css";
import { Bookmark } from "../models/bookmark";
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

// State
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
    renderTopBookmarks();

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
  chrome.tabs.create({ url: "kanban.html" });
}

// Show settings page
function showSettings() {
  chrome.tabs.create({ url: "settings.html" });
}

// Add event listeners
function addEventListeners() {
  // Show Kanban board
  showKanbanBtn.addEventListener("click", showKanbanBoard);

  // Show settings
  settingsBtn.addEventListener("click", showSettings);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initNewTab);
