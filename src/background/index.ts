import storageService from "../utils/storage";
import analyticsService from "../utils/analytics";

// Initialize default data when extension is installed
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("MarkZen installed, initializing default data...");
    await storageService.initializeDefaultData();
  }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRACK_BOOKMARK_CLICK") {
    analyticsService
      .trackBookmarkClick(message.bookmarkId)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));

    // Return true to indicate we will call sendResponse asynchronously
    return true;
  }

  if (message.type === "OPEN_BOOKMARK") {
    // Track the click first
    analyticsService
      .trackBookmarkClick(message.bookmarkId)
      .then(() => {
        // Then open the URL in a new tab
        chrome.tabs.create({ url: message.url });
        sendResponse({ success: true });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true;
  }

  if (message.type === "ADD_CURRENT_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const tab = tabs[0];

        // Get column by ID
        const column = await storageService.getColumn(message.columnId);

        if (!column) {
          sendResponse({
            success: false,
            error: "Column not found",
          });
          return;
        }

        // Create new bookmark
        const newBookmark = {
          id: Date.now().toString(),
          title: message.customTitle || tab.title || "Untitled",
          url: tab.url || "",
          favicon: tab.favIconUrl || "",
          createdAt: new Date().toISOString(),
          columnId: message.columnId,
          workspaceId: message.workspaceId,
        };

        // Add bookmark to storage
        await storageService.saveBookmark(newBookmark);

        // Add bookmark ID to column
        column.bookmarkIds = [newBookmark.id, ...column.bookmarkIds];
        await storageService.saveColumn(column);

        sendResponse({ success: true, bookmark: newBookmark });
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    });

    return true;
  }
});

// Listen for tab updates to sync with Chrome bookmarks (optional feature)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // This could be used to detect when a user creates a bookmark in Chrome
  // and then sync it to MarkZen if desired
});

console.log("MarkZen background service worker initialized");
