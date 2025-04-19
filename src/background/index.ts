// Update src/background/index.ts to handle search-related message types

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

  // This will handle opening a bookmark and tracking the click
  if (message.type === "OPEN_BOOKMARK") {
    console.log("Background received OPEN_BOOKMARK message:", message);

    try {
      // Track the click via analytics
      analyticsService
        .trackBookmarkClick(message.bookmarkId)
        .then(() => {
          console.log("Bookmark click tracked successfully");

          // Open the URL in a new tab with error handling
          try {
            chrome.tabs.create({ url: message.url }, (tab) => {
              if (chrome.runtime.lastError) {
                console.error("Error creating tab:", chrome.runtime.lastError);
                sendResponse({
                  success: false,
                  error: chrome.runtime.lastError.message,
                });
                return;
              }

              console.log("Tab created successfully:", tab);
              sendResponse({ success: true, tabId: tab.id });
            });
          } catch (tabError) {
            console.error("Exception creating tab:", tabError);
            sendResponse({
              success: false,
              error: (tabError as Error).message,
            });
          }
        })
        .catch((error) => {
          console.error("Error tracking bookmark click:", error);

          // Still try to open the tab even if tracking fails
          try {
            chrome.tabs.create({ url: message.url });
            sendResponse({
              success: true,
              warning: "Tab opened but click not tracked",
            });
          } catch (tabError) {
            sendResponse({
              success: false,
              error: (tabError as Error).message,
            });
          }
        });
    } catch (error) {
      console.error("Fatal error in OPEN_BOOKMARK handler:", error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }

    // Return true to indicate we will call sendResponse asynchronously
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

  // New message type to get all bookmarks for search
  if (message.type === "GET_ALL_BOOKMARKS") {
    storageService
      .getBookmarks()
      .then((bookmarks) => {
        sendResponse({ success: true, bookmarks });
      })
      .catch((error) => {
        sendResponse({ success: false, error: (error as Error).message });
      });

    return true;
  }

  // New message type to get all workspaces for search
  if (message.type === "GET_ALL_WORKSPACES") {
    storageService
      .getWorkspaces()
      .then((workspaces) => {
        sendResponse({ success: true, workspaces });
      })
      .catch((error) => {
        sendResponse({ success: false, error: (error as Error).message });
      });

    return true;
  }

  // Listen for tab updates to sync with Chrome bookmarks (optional feature)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // This could be used to detect when a user creates a bookmark in Chrome
    // and then sync it to MarkZen if desired
  });

  console.log("MarkZen background service worker initialized");
});
