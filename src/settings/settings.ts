// Settings management for MarkZen
import "./settings.css";
import { AppSettings } from "../utils/storage";
import storageService from "../utils/storage";
import themeService from "@/utils/theme-service";

// DOM Elements
const elements = {
  // Theme settings
  themeSelect: document.getElementById("theme-select") as HTMLSelectElement,

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

    // Apply current theme
    themeService.applyTheme(currentSettings.theme);
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
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Theme settings
  elements.themeSelect.addEventListener("change", saveSettings);

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
 * Save settings
 */
async function saveSettings(): Promise<void> {
  try {
    // Update settings
    const updatedSettings: AppSettings = {
      ...currentSettings,
      // Theme settings
      theme: elements.themeSelect.value as "light" | "dark" | "system",
    };

    // Save to storage
    await storageService.updateSettings(updatedSettings);

    // Update current settings
    currentSettings = updatedSettings;

    // Apply theme immediately
    themeService.applyTheme(updatedSettings.theme);

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
