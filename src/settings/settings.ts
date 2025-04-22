// Settings management for MarkZen
import "./settings.css";
import { AppSettings } from "../utils/storage";
import storageService from "../utils/storage";
import themeService from "@/utils/theme-service";
import { openOrFocusTab } from "../utils/tab-utils";

// DOM Elements
const elements = {
  // Theme settings
  themeSelect: document.getElementById("theme-select") as HTMLSelectElement,

  // Storage settings
  storageTypeToggle: document.getElementById(
    "storage-type-toggle"
  ) as HTMLInputElement,
  storageStatsDescription: document.getElementById(
    "storage-stats-description"
  ) as HTMLSpanElement,
  storageUsageBar: document.getElementById(
    "storage-usage-bar"
  ) as HTMLDivElement,
  storageUsageText: document.getElementById(
    "storage-usage-text"
  ) as HTMLSpanElement,

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

  // Bookmark expiration
  expirationDaysSelect: document.getElementById(
    "expiration-days-select"
  ) as HTMLSelectElement,
};

// Current settings
let currentSettings: AppSettings;

// Keep track of whether initialization has completed
let initialized = false;

/**
 * Initialize the settings page
 */
async function initSettings(): Promise<void> {
  if (initialized) {
    console.log("Settings already initialized, skipping");
    return;
  }

  try {
    console.log("Initializing settings page");

    // Load settings
    currentSettings = await storageService.getSettings();
    console.log("Current settings loaded:", currentSettings);

    // Apply settings to form elements
    applySettingsToForm();

    // Set up event listeners
    setupEventListeners();

    // Apply current theme
    themeService.applyTheme(currentSettings.theme);

    // Update storage stats initially
    await updateStorageStats();

    // Set update interval for storage stats
    const statsInterval = setInterval(updateStorageStats, 60000);

    // Store interval ID so we can clear it if needed
    window.addEventListener("beforeunload", () => {
      clearInterval(statsInterval);
    });

    // Mark as initialized
    initialized = true;
    console.log("Settings initialization complete");
  } catch (error) {
    console.error("Error initializing settings:", error);
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
  console.log("Applying settings to form:", currentSettings);

  // Storage settings first
  elements.storageTypeToggle.checked = currentSettings.storageType === "sync";

  // Set expiration days value with better validation and logging
  requestAnimationFrame(() => {
    console.log("About to set expiration days value");
    if (elements.expirationDaysSelect) {
      const expirationValue = currentSettings.bookmarkExpirationDays;

      if (expirationValue === undefined || expirationValue === null) {
        elements.expirationDaysSelect.value = "never";
      } else {
        elements.expirationDaysSelect.value = expirationValue.toString();
      }
    }
  });

  // Theme settings with a small delay to ensure DOM is ready
  requestAnimationFrame(() => {
    if (elements.themeSelect) {
      elements.themeSelect.value = currentSettings.theme;
      console.log("Theme select value set to:", elements.themeSelect.value);
    } else {
      console.error("Theme select element not found");
    }
  });

  // Update storage usage stats
  updateStorageStats();
}

/**
 * Set up event listeners
 * Ensures that listeners are only added once
 */
function setupEventListeners(): void {
  // Theme settings
  const themeSelect = elements.themeSelect;
  const newThemeSelect = themeSelect.cloneNode(true) as HTMLSelectElement;
  themeSelect.parentNode?.replaceChild(newThemeSelect, themeSelect);
  elements.themeSelect = newThemeSelect;
  elements.themeSelect.addEventListener("change", saveSettings);

  // Storage settings
  const storageTypeToggle = elements.storageTypeToggle;
  const newStorageTypeToggle = storageTypeToggle.cloneNode(
    true
  ) as HTMLInputElement;
  storageTypeToggle.parentNode?.replaceChild(
    newStorageTypeToggle,
    storageTypeToggle
  );
  elements.storageTypeToggle = newStorageTypeToggle;

  // Add event listener with a named function so we can log when it's called
  elements.storageTypeToggle.addEventListener("change", async () => {
    console.log("Storage type change event triggered");
    const newStorageType = elements.storageTypeToggle.checked
      ? "sync"
      : "local";

    // Show confirmation dialog
    const confirmed = await showConfirmationDialog(
      "Change Storage Type",
      `Are you sure you want to change to ${
        newStorageType === "local" ? "local" : "sync"
      } storage? 
      
This will migrate all your data to ${
        newStorageType === "local"
          ? "this device only"
          : "Chrome sync storage across all your devices"
      }.

${
  newStorageType === "sync"
    ? "Note: Sync storage has a limit of 100KB. If your data exceeds this limit, the migration will fail."
    : ""
}`
    );

    console.log("Confirmation result:", confirmed);

    if (confirmed) {
      await handleStorageTypeChange(newStorageType);
    } else {
      // Reset the toggle to current value
      elements.storageTypeToggle.checked =
        currentSettings.storageType === "sync";
    }
  });

  // Data management
  const exportDataBtn = elements.exportDataBtn;
  const newExportDataBtn = exportDataBtn.cloneNode(true) as HTMLButtonElement;
  exportDataBtn.parentNode?.replaceChild(newExportDataBtn, exportDataBtn);
  elements.exportDataBtn = newExportDataBtn;
  elements.exportDataBtn.addEventListener("click", exportData);

  const importDataBtn = elements.importDataBtn;
  const newImportDataBtn = importDataBtn.cloneNode(true) as HTMLButtonElement;
  importDataBtn.parentNode?.replaceChild(newImportDataBtn, importDataBtn);
  elements.importDataBtn = newImportDataBtn;
  elements.importDataBtn.addEventListener("click", () =>
    elements.importFileInput.click()
  );

  const importFileInput = elements.importFileInput;
  const newImportFileInput = importFileInput.cloneNode(
    true
  ) as HTMLInputElement;
  importFileInput.parentNode?.replaceChild(newImportFileInput, importFileInput);
  elements.importFileInput = newImportFileInput;
  elements.importFileInput.addEventListener("change", importData);

  const resetDataBtn = elements.resetDataBtn;
  const newResetDataBtn = resetDataBtn.cloneNode(true) as HTMLButtonElement;
  resetDataBtn.parentNode?.replaceChild(newResetDataBtn, resetDataBtn);
  elements.resetDataBtn = newResetDataBtn;
  elements.resetDataBtn.addEventListener("click", resetData);

  // Notification
  const notificationClose = elements.notificationClose;
  const newNotificationClose = notificationClose.cloneNode(
    true
  ) as HTMLButtonElement;
  notificationClose.parentNode?.replaceChild(
    newNotificationClose,
    notificationClose
  );
  elements.notificationClose = newNotificationClose;
  elements.notificationClose.addEventListener("click", () => {
    elements.notification.classList.add("hidden");
  });

  // Bookmark expiration settings
  const expirationDaysSelect = elements.expirationDaysSelect;
  const newExpirationDaysSelect = expirationDaysSelect.cloneNode(
    true
  ) as HTMLSelectElement;
  expirationDaysSelect.parentNode?.replaceChild(
    newExpirationDaysSelect,
    expirationDaysSelect
  );
  elements.expirationDaysSelect = newExpirationDaysSelect;
  elements.expirationDaysSelect.addEventListener("change", saveSettings);

  // Navigation event listeners
  document.getElementById("kanban-btn")?.addEventListener("click", () => {
    openOrFocusTab("kanban.html");
  });

  document.getElementById("note-btn")?.addEventListener("click", () => {
    openOrFocusTab("note.html");
  });

  // Log for debugging
  console.log("Event listeners have been set up");
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
      // Add expiration days setting
      bookmarkExpirationDays:
        elements.expirationDaysSelect.value === "never"
          ? "never"
          : parseInt(elements.expirationDaysSelect.value, 10),
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

        chrome.storage.local.set({
          bookmarkStats: jsonData.bookmarkStats,
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

/**
 * Handle storage type change
 * This function manages the UI during storage migration
 */
async function handleStorageTypeChange(
  newStorageType: "local" | "sync"
): Promise<void> {
  try {
    // Show migration indicator
    const migrationIndicator = document.createElement("div");
    migrationIndicator.className = "migration-indicator";
    migrationIndicator.innerHTML = `
      <div class="migration-indicator-spinner"></div>
      <span>Migrating data to ${newStorageType} storage...</span>
    `;

    // Append it to container
    const container = elements.storageTypeToggle.closest(".setting-item");
    container?.appendChild(migrationIndicator);

    // Disable the toggle during migration
    elements.storageTypeToggle.disabled = true;

    // Update settings with new storage type
    await storageService.updateSettings({ storageType: newStorageType });

    // Update current settings
    currentSettings = await storageService.getSettings();

    // Remove migration indicator
    migrationIndicator.remove();
    elements.storageTypeToggle.disabled = false;

    // Update storage stats
    await updateStorageStats();

    showNotification(
      `Data successfully migrated to ${newStorageType} storage`,
      "success"
    );
  } catch (error) {
    // Reset the toggle to current value
    elements.storageTypeToggle.checked = currentSettings.storageType === "sync";

    // Remove migration indicator if it exists
    const migrationIndicator = document.querySelector(".migration-indicator");
    if (migrationIndicator) {
      migrationIndicator.remove();
    }

    elements.storageTypeToggle.disabled = false;

    showNotification(
      `Error changing storage type: ${(error as Error).message}`,
      "error"
    );
  }
}

/**
 * Show a confirmation dialog
 * Ensures only one dialog is shown at a time
 */
function showConfirmationDialog(
  title: string,
  message: string
): Promise<boolean> {
  // First, remove any existing dialogs to prevent duplicates
  const existingOverlays = document.querySelectorAll(
    ".confirmation-dialog-overlay"
  );
  existingOverlays.forEach((overlay) => {
    document.body.removeChild(overlay);
  });

  return new Promise((resolve) => {
    // Create modal overlay with a specific class for easier cleanup
    const overlay = document.createElement("div");
    overlay.className = "confirmation-dialog-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "1000";

    // Create modal
    const modal = document.createElement("div");
    modal.className = "confirmation-dialog-modal";
    modal.style.backgroundColor = "var(--color-background)";
    modal.style.borderRadius = "var(--border-radius)";
    modal.style.boxShadow = "var(--shadow)";
    modal.style.padding = "24px";
    modal.style.maxWidth = "400px";
    modal.style.width = "100%";

    // Create modal title
    const modalTitle = document.createElement("h2");
    modalTitle.textContent = title;
    modalTitle.style.marginBottom = "16px";
    modalTitle.style.fontSize = "18px";
    modalTitle.style.fontWeight = "600";

    // Create modal message
    const modalMessage = document.createElement("p");
    modalMessage.textContent = message;
    modalMessage.style.marginBottom = "24px";
    modalMessage.style.fontSize = "14px";
    modalMessage.style.lineHeight = "1.5";
    modalMessage.style.whiteSpace = "pre-line";

    // Create modal actions
    const modalActions = document.createElement("div");
    modalActions.style.display = "flex";
    modalActions.style.justifyContent = "flex-end";
    modalActions.style.gap = "12px";

    // Create cancel button
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.className = "setting-button cancel-button";
    cancelButton.addEventListener(
      "click",
      () => {
        document.body.removeChild(overlay);
        resolve(false);
      },
      { once: true }
    ); // Use once to ensure event only triggers once

    // Create confirm button
    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Confirm";
    confirmButton.className = "setting-button confirm-button";
    confirmButton.style.backgroundColor = "var(--color-primary)";
    confirmButton.style.color = "white";
    confirmButton.addEventListener(
      "click",
      () => {
        document.body.removeChild(overlay);
        resolve(true);
      },
      { once: true }
    ); // Use once to ensure event only triggers once

    // Append elements
    modalActions.appendChild(cancelButton);
    modalActions.appendChild(confirmButton);

    modal.appendChild(modalTitle);
    modal.appendChild(modalMessage);
    modal.appendChild(modalActions);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

/**
 * Update storage usage statistics
 * This function calculates and displays current storage usage
 */
async function updateStorageStats(): Promise<void> {
  try {
    const storageType = currentSettings.storageType || "local";
    const storage =
      storageType === "local" ? chrome.storage.local : chrome.storage.sync;

    // Get current usage
    const data = await new Promise<Record<string, any>>((resolve) => {
      storage.get(null, (items) => {
        resolve(items || {});
      });
    });

    // Calculate data size
    const jsonData = JSON.stringify(data);
    const dataSize = new Blob([jsonData]).size;

    // Calculate percentage - use appropriate storage limits
    const maxSize = storageType === "local" ? 5 * 1024 * 1024 : 100 * 1024; // 5MB for local, 100KB for sync
    const usagePercentage = Math.min(
      100,
      Math.round((dataSize / maxSize) * 100)
    );

    // Format sizes for display
    const dataSizeFormatted = formatBytes(dataSize);
    const maxSizeFormatted = formatBytes(maxSize);

    // Update UI elements
    elements.storageStatsDescription.textContent = `Using ${dataSizeFormatted} of ${maxSizeFormatted} (${storageType} storage)`;

    elements.storageUsageBar.style.width = `${usagePercentage}%`;
    elements.storageUsageText.textContent = `${usagePercentage}%`;

    // Add warning classes for high usage
    elements.storageUsageBar.classList.remove("warning", "danger");
    if (usagePercentage >= 90) {
      elements.storageUsageBar.classList.add("danger");
    } else if (usagePercentage >= 75) {
      elements.storageUsageBar.classList.add("warning");
    }

    // Log storage info for debugging
    console.log(
      `Storage usage: ${dataSizeFormatted} of ${maxSizeFormatted} (${usagePercentage}%)`
    );
  } catch (error) {
    console.error("Error calculating storage usage:", error);
    elements.storageStatsDescription.textContent = `Error calculating storage usage: ${
      (error as Error).message
    }`;
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    console.log("DOM loaded, initializing storage service");

    // Initialize storage service first
    await storageService.initialize();

    // Then initialize settings once
    await initSettings();
  },
  { once: true }
); // Use once to ensure it only runs once
