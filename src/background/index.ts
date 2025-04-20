import rootService from "../services/RootService";

console.log("Background script starting...");

// Initialize services when extension loads
const initializeExtension = async () => {
  try {
    await rootService.initialize();
    console.log("Services initialized");
  } catch (error) {
    console.error("Initialization error:", error);
    throw error;
  }
};

// Run initialization
initializeExtension().catch((error) => {
  console.error("Failed to initialize extension:", error);
});

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log(`Extension event: ${details.reason}`);

    if (details.reason === "install") {
      console.log("New installation detected, initializing default data...");
      await rootService.initialize();
      await rootService.storage.initializeDefaultData();
      console.log("Default data initialized successfully");
    }
  } catch (error) {
    console.error("Installation handling failed:", error);
  }
});

// Add this function before the message listener

async function getPageMetadata(
  tabId: number
): Promise<{ description: string; keywords: string[] }> {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const metaDescription =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "";
      const metaKeywords =
        document
          .querySelector('meta[name="keywords"]')
          ?.getAttribute("content") || "";
      return {
        description: metaDescription,
        keywords: metaKeywords
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ""),
      };
    },
  });

  return result[0].result!;
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!rootService.isReady()) {
    sendResponse({ success: false, error: "Services not initialized" });
    return false;
  }

  console.log("Received message:", message.type);

  if (message.type === "OPEN_BOOKMARK") {
    try {
      rootService.analytics
        .trackBookmarkClick(message.bookmarkId)
        .then(() => {
          chrome.tabs.create({ url: message.url }, (tab) => {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
              return;
            }
            sendResponse({ success: true, tabId: tab.id });
          });
        })
        .catch((error) => {
          console.error("Error tracking bookmark:", error);
          chrome.tabs.create({ url: message.url });
          sendResponse({
            success: true,
            warning: "Tab opened but click not tracked",
          });
        });

      return true; // Will respond asynchronously
    } catch (error) {
      console.error("Fatal error in OPEN_BOOKMARK handler:", error);
      sendResponse({
        success: false,
        error: (error as Error).message,
      });
    }
  }

  if (message.type === "ADD_CURRENT_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const tab = tabs[0];

        // Get column by ID
        const column = await rootService.storage.getColumn(message.columnId);

        if (!column) {
          sendResponse({
            success: false,
            error: "Column not found",
          });
          return;
        }

        // Get metadata for the current page
        const metadata = await getPageMetadata(tab.id!);

        // Create new bookmark
        const newBookmark = {
          id: Date.now().toString(),
          title: message.customTitle || tab.title || "Untitled",
          url: tab.url || "",
          favicon: tab.favIconUrl || "",
          description: metadata.description,
          tags: metadata.keywords,
          createdAt: new Date().toISOString(),
          columnId: message.columnId,
          workspaceId: message.workspaceId,
        };

        // Add bookmark to storage
        await rootService.storage.saveBookmark(newBookmark);

        // Add bookmark ID to column
        column.bookmarkIds = [newBookmark.id, ...column.bookmarkIds];
        await rootService.storage.saveColumn(column);

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

console.log("Background script setup complete");
