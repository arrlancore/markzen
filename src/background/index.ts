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
    // Get current page info and add as bookmark
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const tab = tabs[0];
        const workspaceSettings = await storageService.getWorkspaceSettings();
        const activeWorkspaceId = workspaceSettings.lastVisitedWorkspaceId;

        // Get the first column in the active workspace to add the bookmark to
        const columns = await storageService.getWorkspaceColumns(
          activeWorkspaceId
        );

        if (columns.length === 0) {
          sendResponse({
            success: false,
            error: "No columns found in workspace",
          });
          return;
        }

        const firstColumn = columns[0];

        // Create new bookmark
        const newBookmark = {
          id: Date.now().toString(),
          title: tab.title || "Untitled",
          url: tab.url || "",
          favicon: tab.favIconUrl || "",
          createdAt: new Date().toISOString(),
          columnId: firstColumn.id,
          workspaceId: activeWorkspaceId,
        };

        // Add bookmark to storage
        await storageService.saveBookmark(newBookmark);

        // Add bookmark ID to column
        firstColumn.bookmarkIds = [newBookmark.id, ...firstColumn.bookmarkIds];
        await storageService.saveColumn(firstColumn);

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
