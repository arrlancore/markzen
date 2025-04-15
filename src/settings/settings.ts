// Settings management for MarkZen
import "./settings.css";
import { AppSettings } from "../utils/storage";
import storageService from "../utils/storage";

// DOM Elements
const elements = {
  // Theme settings
  themeSelect: document.getElementById("theme-select") as HTMLSelectElement,

  // New tab settings
  backgroundSelect: document.getElementById(
    "background-select"
  ) as HTMLSelectElement,
  unsplashCategoryContainer: document.getElementById(
    "unsplash-category-container"
  ) as HTMLDivElement,
  unsplashCategorySelect: document.getElementById(
    "unsplash-category-select"
  ) as HTMLSelectElement,
  backgroundColorContainer: document.getElementById(
    "background-color-container"
  ) as HTMLDivElement,
  backgroundColor: document.getElementById(
    "background-color"
  ) as HTMLInputElement,
  showClockToggle: document.getElementById(
    "show-clock-toggle"
  ) as HTMLInputElement,
  showDateToggle: document.getElementById(
    "show-date-toggle"
  ) as HTMLInputElement,
  showTopBookmarksToggle: document.getElementById(
    "show-top-bookmarks-toggle"
  ) as HTMLInputElement,
  topBookmarksCountContainer: document.getElementById(
    "top-bookmarks-count-container"
  ) as HTMLDivElement,
  topBookmarksCount: document.getElementById(
    "top-bookmarks-count"
  ) as HTMLInputElement,

  // Bookmark settings
  showFaviconsToggle: document.getElementById(
    "show-favicons-toggle"
  ) as HTMLInputElement,

  // Data management
  exportDataBtn: document.getElementById(
    "export-data-btn"
  ) as HTMLButtonElement,
  importDataBtn: document.getElementById(
    "import-data-btn"
  ) as HTMLButtonElement,
  importFileInput: document.getElementById(
    "import-file-input"
  ) as HTMLInputElement,
  resetDataBtn: document.getElementById("reset-data-btn") as HTMLButtonElement,

  // Navigation
  backBtn: document.getElementById("back-btn") as HTMLButtonElement,

  // Notification
  notification: document.getElementById("notification") as HTMLDivElement,
  notificationMessage: document.getElementById(
    "notification-message"
  ) as HTMLSpanElement,
  notificationClose: document.getElementById(
    "notification-close"
  ) as HTMLButtonElement,
};

// Current settings
let currentSettings: AppSettings;

/**
 * Initialize the settings page
 */
async function initSettings(): Promise<void> {
  try {
    // Load settings
    currentSettings = await storageService.getSettings();

    // Apply settings to form elements
    applySettingsToForm();

    // Set up event listeners
    setupEventListeners();

    // Initialize UI state based on settings
    updateDependentControls();
  } catch (error) {
    showNotification(
      `Error loading settings: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Apply loaded settings to form elements
 */
function applySettingsToForm(): void {
  // Theme settings
  elements.themeSelect.value = currentSettings.theme;

  // New tab settings
  elements.backgroundSelect.value = currentSettings.newtabBackground;
  if (currentSettings.unsplashCategory) {
    elements.unsplashCategorySelect.value = currentSettings.unsplashCategory;
  }
  if (currentSettings.backgroundColor) {
    elements.backgroundColor.value = currentSettings.backgroundColor;
  }
  elements.showClockToggle.checked = currentSettings.showClock;
  elements.showDateToggle.checked = currentSettings.showDate;
  elements.showTopBookmarksToggle.checked = currentSettings.showTopBookmarks;
  elements.topBookmarksCount.value =
    currentSettings.topBookmarksCount.toString();

  // Bookmark settings
  elements.showFaviconsToggle.checked = currentSettings.showFavicons;
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Theme settings
  elements.themeSelect.addEventListener("change", saveSettings);

  // New tab settings
  elements.backgroundSelect.addEventListener("change", () => {
    updateDependentControls();
    saveSettings();
  });
  elements.unsplashCategorySelect.addEventListener("change", saveSettings);
  elements.backgroundColor.addEventListener("change", saveSettings);
  elements.showClockToggle.addEventListener("change", saveSettings);
  elements.showDateToggle.addEventListener("change", saveSettings);
  elements.showTopBookmarksToggle.addEventListener("change", () => {
    updateDependentControls();
    saveSettings();
  });
  elements.topBookmarksCount.addEventListener("change", saveSettings);

  // Bookmark settings
  elements.showFaviconsToggle.addEventListener("change", saveSettings);

  // Data management
  elements.exportDataBtn.addEventListener("click", exportData);
  elements.importDataBtn.addEventListener("click", () =>
    elements.importFileInput.click()
  );
  elements.importFileInput.addEventListener("change", importData);
  elements.resetDataBtn.addEventListener("click", resetData);

  // Navigation
  elements.backBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "kanban.html" });
  });

  // Notification
  elements.notificationClose.addEventListener("click", () => {
    elements.notification.classList.add("hidden");
  });
}

/**
 * Update dependent controls based on current settings
 */
function updateDependentControls(): void {
  // Background type dependent controls
  const backgroundType = elements.backgroundSelect.value;
  elements.unsplashCategoryContainer.classList.toggle(
    "hidden",
    backgroundType !== "unsplash"
  );
  elements.backgroundColorContainer.classList.toggle(
    "hidden",
    backgroundType !== "color"
  );

  // Top bookmarks dependent controls
  const showTopBookmarks = elements.showTopBookmarksToggle.checked;
  elements.topBookmarksCountContainer.classList.toggle(
    "hidden",
    !showTopBookmarks
  );
}

/**
 * Save settings
 */
async function saveSettings(): Promise<void> {
  try {
    // Validate top bookmarks count
    const topBookmarksCount = parseInt(elements.topBookmarksCount.value);
    if (
      isNaN(topBookmarksCount) ||
      topBookmarksCount < 1 ||
      topBookmarksCount > 20
    ) {
      elements.topBookmarksCount.value = "10";
    }

    // Update settings
    const updatedSettings: AppSettings = {
      // Theme settings
      theme: elements.themeSelect.value as "light" | "dark" | "system",

      // New tab settings
      newtabBackground: elements.backgroundSelect.value as
        | "color"
        | "image"
        | "unsplash",
      unsplashCategory: elements.unsplashCategorySelect.value,
      backgroundColor: elements.backgroundColor.value,
      showClock: elements.showClockToggle.checked,
      showDate: elements.showDateToggle.checked,
      showTopBookmarks: elements.showTopBookmarksToggle.checked,
      topBookmarksCount: parseInt(elements.topBookmarksCount.value),

      // Bookmark settings
      showFavicons: elements.showFaviconsToggle.checked,
    };

    // Save to storage
    await storageService.updateSettings(updatedSettings);

    // Update current settings
    currentSettings = updatedSettings;

    showNotification("Settings saved successfully", "success");
  } catch (error) {
    showNotification(
      `Error saving settings: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Export all data as a JSON file
 */
async function exportData(): Promise<void> {
  try {
    // Get all data
    const data = {
      settings: await storageService.getSettings(),
      workspaces: await storageService.getWorkspaces(),
      columns: await storageService.getColumns(),
      bookmarks: await storageService.getBookmarks(),
      workspaceSettings: await storageService.getWorkspaceSettings(),
    };

    // Convert to JSON
    const jsonData = JSON.stringify(data, null, 2);

    // Create blob and download link
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `markzen-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    // Trigger download
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up
    URL.revokeObjectURL(url);

    showNotification("Data exported successfully", "success");
  } catch (error) {
    showNotification(
      `Error exporting data: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Import data from a JSON file
 */
async function importData(): Promise<void> {
  try {
    const file = elements.importFileInput.files?.[0];
    if (!file) {
      showNotification("No file selected", "error");
      return;
    }

    // Read file
    const fileReader = new FileReader();
    fileReader.onload = async (e) => {
      try {
        // Parse JSON
        const jsonData = JSON.parse(e.target?.result as string);

        // Validate data structure
        if (
          !jsonData.settings ||
          !jsonData.workspaces ||
          !jsonData.columns ||
          !jsonData.bookmarks ||
          !jsonData.workspaceSettings
        ) {
          showNotification("Invalid backup file format", "error");
          return;
        }

        // Confirm import
        const confirmed = confirm(
          "This will replace all your current data. Are you sure you want to continue?"
        );
        if (!confirmed) return;

        // Import data
        await storageService.updateSettings(jsonData.settings);

        // Store workspaces
        chrome.storage.local.set({ workspaces: jsonData.workspaces });

        // Store columns
        chrome.storage.local.set({ columns: jsonData.columns });

        // Store bookmarks
        chrome.storage.local.set({ bookmarks: jsonData.bookmarks });

        // Store workspace settings
        chrome.storage.local.set({
          workspaceSettings: jsonData.workspaceSettings,
        });

        showNotification("Data imported successfully", "success");

        // Reload form with new settings
        currentSettings = jsonData.settings;
        applySettingsToForm();
        updateDependentControls();
      } catch (error) {
        showNotification(
          `Error parsing backup file: ${(error as Error).message}`,
          "error"
        );
      }
    };

    fileReader.readAsText(file);
  } catch (error) {
    showNotification(
      `Error importing data: ${(error as Error).message}`,
      "error"
    );
  }

  // Clear the file input
  elements.importFileInput.value = "";
}

/**
 * Reset all data to defaults
 */
async function resetData(): Promise<void> {
  // Confirm reset
  const confirmed = confirm(
    "This will delete all your workspaces, columns, and bookmarks. Are you sure you want to continue?"
  );
  if (!confirmed) return;

  try {
    // Clear all data
    await chrome.storage.local.clear();

    // Reinitialize default data
    await storageService.initializeDefaultData();

    // Reload settings
    currentSettings = await storageService.getSettings();

    // Apply settings to form
    applySettingsToForm();
    updateDependentControls();

    showNotification("All data has been reset to defaults", "success");
  } catch (error) {
    showNotification(
      `Error resetting data: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Show a notification
 * @param message Message to display
 * @param type Type of notification (success, error, warning)
 */
function showNotification(
  message: string,
  type: "success" | "error" | "warning" = "success"
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

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initSettings);
