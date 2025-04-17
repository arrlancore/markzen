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
    renderTopBookmarks();
    addEventListeners();
  } catch (error) {
    console.error("Error initializing new tab:", error);
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

// Add event listeners
function addEventListeners() {
  // Show Kanban board
  showKanbanBtn.addEventListener("click", showKanbanBoard);

  // Show settings
  settingsBtn.addEventListener("click", showSettings);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initNewTab);
