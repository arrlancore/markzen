import "./note.css";
import noteService from "../utils/note-service";
import { parseMarkdown } from "../utils/markdown-parser";
import themeService from "../utils/theme-service";
import { openOrFocusTab } from "@/utils/tab-utils";

// DOM Elements
const noteContent = document.getElementById(
  "note-content"
) as HTMLTextAreaElement;
const notePreview = document.getElementById("note-preview") as HTMLDivElement;
const previewToggleBtn = document.getElementById(
  "preview-toggle-btn"
) as HTMLButtonElement;
const editorSection = document.getElementById(
  "editor-section"
) as HTMLDivElement;
const previewSection = document.getElementById(
  "preview-section"
) as HTMLDivElement;
const helpBtn = document.getElementById("help-btn") as HTMLButtonElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const markdownHelp = document.getElementById("markdown-help") as HTMLDivElement;
const closeMarkdownHelp = document.getElementById(
  "close-markdown-help"
) as HTMLButtonElement;
const noteSaveStatus = document.getElementById(
  "note-save-status"
) as HTMLSpanElement;
const noteCharCount = document.getElementById(
  "note-char-count"
) as HTMLSpanElement;
const notification = document.getElementById("notification") as HTMLDivElement;
const notificationMessage = document.getElementById(
  "notification-message"
) as HTMLSpanElement;
const notificationClose = document.getElementById(
  "notification-close"
) as HTMLButtonElement;

// Saving variables
let lastContent = "";
let isSaving = false;
let isPreviewMode = false;

// Initialize note page
async function initNotePage() {
  try {
    // Apply theme
    await themeService.applyThemeFromSettings();

    // Load note content
    const content = await noteService.loadNote();
    noteContent.value = content;
    lastContent = content; // Track initial content for change detection
    updateCharCount();

    // Add event listeners
    addEventListeners();

    // Setup auto-save
    setupAutoSave();
  } catch (error) {
    console.error("Error initializing note page:", error);
    showNotification(
      `Error loading note: ${(error as Error).message}`,
      "error"
    );
  }
}

// Add event listeners
// Add event listeners
function addEventListeners() {
  // Preview toggle
  previewToggleBtn.addEventListener("click", togglePreview);

  // Note content changes - with optimized auto-save
  noteContent.addEventListener("input", () => {
    updateCharCount();
    // Auto-save is handled by the setupAutoSave function
  });

  // Help button
  helpBtn.addEventListener("click", toggleMarkdownHelp);

  // Close help
  closeMarkdownHelp.addEventListener("click", toggleMarkdownHelp);

  // Navigation event listeners
  document.getElementById("kanban-btn")?.addEventListener("click", () => {
    // Save changes before navigating
    const currentContent = noteContent.value;
    if (currentContent !== lastContent) {
      noteService.saveNote(currentContent, true);
    }
    openOrFocusTab("kanban.html");
  });

  document.getElementById("settings-btn")?.addEventListener("click", () => {
    // Save changes before navigating
    const currentContent = noteContent.value;
    if (currentContent !== lastContent) {
      noteService.saveNote(currentContent, true);
    }
    openOrFocusTab("settings.html");
  });

  // Notification close
  notificationClose.addEventListener("click", () => {
    notification.classList.add("hidden");
  });

  // Handle keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl+P to toggle preview
    if (e.ctrlKey && e.key === "p") {
      e.preventDefault();
      togglePreview();
    }

    // Escape to close markdown help
    if (e.key === "Escape" && !markdownHelp.classList.contains("hidden")) {
      toggleMarkdownHelp();
    }
  });
}

// Set up auto-save with optimization
function setupAutoSave() {
  // Initial state
  let saveTimeout: number | null = null;

  // Function to check for changes and save if needed
  const checkAndSave = () => {
    const currentContent = noteContent.value;

    // Check if content has changed
    if (currentContent !== lastContent) {
      // Show saving status
      updateSaveStatus("saving");

      // Update last known content
      lastContent = currentContent;

      // Save the content (debounced)
      if (saveTimeout) {
        window.clearTimeout(saveTimeout);
      }

      // Set timeout to save after typing stops (500ms)
      saveTimeout = window.setTimeout(() => {
        noteService.saveNote(currentContent);
        updateSaveStatus("saved");
        saveTimeout = null;
      }, 500);
    }
  };

  // Check for changes every 300ms (ensures responsive feel without too many checks)
  setInterval(checkAndSave, 300);

  // Also check when the page loses focus or is about to unload
  window.addEventListener("blur", () => {
    const currentContent = noteContent.value;
    if (currentContent !== lastContent) {
      noteService.saveNote(currentContent, true);
      lastContent = currentContent;
    }
  });

  window.addEventListener("beforeunload", () => {
    const currentContent = noteContent.value;
    if (currentContent !== lastContent) {
      noteService.saveNote(currentContent, true);
    }
  });
}

// Simplified toggle preview function
function togglePreview() {
  // Prevent multiple rapid toggles
  if (previewToggleBtn.disabled) return;
  previewToggleBtn.disabled = true;

  isPreviewMode = !isPreviewMode;
  const content = noteContent.value;

  if (isPreviewMode) {
    // Switch to preview mode
    const html = parseMarkdown(content);
    notePreview.innerHTML = html;
    editorSection.style.display = "none";
    previewSection.style.display = "block";
    console.log("Switched to preview mode");
  } else {
    // Switch to edit mode
    editorSection.style.display = "block";
    previewSection.style.display = "none";
    noteContent.focus();
    console.log("Switched to edit mode");
  }

  // Re-enable the button after a short delay
  setTimeout(() => {
    previewToggleBtn.disabled = false;
  }, 300);
}

// Update character count
function updateCharCount() {
  const count = noteContent.value.length;
  noteCharCount.textContent = count.toString();
}

// Update save status with visual feedback
function updateSaveStatus(
  status: "saving" | "saved" | "error",
  errorMessage?: string
) {
  noteSaveStatus.classList.add("visible");

  if (status === "saving") {
    noteSaveStatus.textContent = "Saving...";
    noteSaveStatus.classList.remove("success", "error");
  } else if (status === "saved") {
    noteSaveStatus.textContent = "Saved";
    noteSaveStatus.classList.add("success");
    noteSaveStatus.classList.remove("error");

    // Hide after 2 seconds
    setTimeout(() => {
      noteSaveStatus.classList.remove("visible");
    }, 2000);
  } else if (status === "error") {
    noteSaveStatus.textContent = errorMessage || "Error saving";
    noteSaveStatus.classList.add("error");
    noteSaveStatus.classList.remove("success");
  }
}

// Toggle markdown help
function toggleMarkdownHelp() {
  markdownHelp.classList.toggle("hidden");
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

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initNotePage);
