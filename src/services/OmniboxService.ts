// OmniboxService.ts
// Service to handle omnibox search functionality for the extension

import { Bookmark } from "../models/bookmark";
import { Workspace } from "../models/workspace";
import { fuzzySearch, formatTextWithHighlights } from "../utils/fuzzy-search";
import { StorageService } from "../utils/storage";

// Maximum number of suggestions to show in omnibox
const MAX_SUGGESTIONS = 8;

interface SearchMatch {
  item: Bookmark;
  matchPositions: Array<{
    fieldName: string;
    indices: Array<[number, number]>; // tuple of [startIndex, length]
  }>;
}

export class OmniboxService {
  private isInitialized = false;
  private storageService: StorageService;
  private bookmarks: Record<string, Bookmark> = {};
  private workspaces: Record<string, Workspace> = {};

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  /**
   * Initialize the omnibox service by setting up event listeners
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register event listeners
      chrome.omnibox.onInputStarted.addListener(
        this.handleInputStarted.bind(this)
      );
      chrome.omnibox.onInputChanged.addListener(
        this.handleInputChanged.bind(this)
      );
      chrome.omnibox.onInputEntered.addListener(
        this.handleInputEntered.bind(this)
      );

      // Set default suggestion
      chrome.omnibox.setDefaultSuggestion({
        description: "Search your MarkZen bookmarks",
      });

      this.isInitialized = true;
      console.log("Omnibox service initialized");
    } catch (error) {
      console.error("Failed to initialize omnibox service:", error);
      throw error;
    }
  }

  /**
   * Handle when the user starts typing in the omnibox
   */
  private async handleInputStarted(): Promise<void> {
    try {
      // Load all bookmarks and workspaces
      await this.loadData();

      // Set default suggestion
      chrome.omnibox.setDefaultSuggestion({
        description: "Search your MarkZen bookmarks",
      });
    } catch (error) {
      console.error("Error in omnibox input started handler:", error);
      chrome.omnibox.setDefaultSuggestion({
        description: "Error loading bookmarks: " + (error as Error).message,
      });
    }
  }

  /**
   * Handle when the user changes their input in the omnibox
   */
  private async handleInputChanged(
    text: string,
    suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void
  ): Promise<void> {
    try {
      // If text is empty, show default suggestion
      if (!text.trim()) {
        suggest([]);
        return;
      }

      // Ensure we have bookmark data
      if (Object.keys(this.bookmarks).length === 0) {
        await this.loadData();
      }

      // Get search results
      const results = this.searchBookmarks(text);

      // Convert to omnibox suggestions
      const suggestions = results.map((result) => {
        const bookmark = result.item;
        const workspace =
          this.workspaces[bookmark.workspaceId]?.name || "Unknown";
        const query = text.toLowerCase().trim();

        // Create simple highlighted title
        const titleIndex = bookmark.title.toLowerCase().indexOf(query);
        const title = this.escapeXml(bookmark.title);
        const highlightedTitle =
          titleIndex !== -1
            ? `${title.slice(0, titleIndex)}<match>${title.slice(
                titleIndex,
                titleIndex + query.length
              )}</match>${title.slice(titleIndex + query.length)}`
            : title;

        // Create simple highlighted URL
        const truncatedUrl = this.truncateUrl(bookmark.url);
        const displayUrl = this.escapeXml(truncatedUrl);
        const urlIndex = displayUrl.toLowerCase().indexOf(query);
        const highlightedUrl =
          urlIndex !== -1
            ? `${displayUrl.slice(0, urlIndex)}<match>${displayUrl.slice(
                urlIndex,
                urlIndex + query.length
              )}</match>${displayUrl.slice(urlIndex + query.length)}`
            : displayUrl;

        return {
          content: bookmark.url,
          description: `${highlightedTitle} <dim>(${this.escapeXml(
            workspace
          )})</dim> <url>${highlightedUrl}</url>`,
          deletable: false,
        };
      });

      // Add a hint suggestion if no matches found
      if (suggestions.length === 0) {
        suggest([
          {
            content: "no_results",
            description:
              "No bookmarks found matching: <match>" + text + "</match>",
            deletable: false,
          },
        ]);
        return;
      }

      // Provide suggestions
      suggest(suggestions.slice(0, MAX_SUGGESTIONS));
    } catch (error) {
      console.error("Error in omnibox input changed handler:", error);
      suggest([
        {
          content: "error",
          description: "Error searching bookmarks: " + (error as Error).message,
          deletable: false,
        },
      ]);
    }
  }

  /**
   * Handle when the user selects a suggestion from the omnibox
   */
  private async handleInputEntered(
    text: string,
    disposition: chrome.omnibox.OnInputEnteredDisposition
  ): Promise<void> {
    try {
      // Skip special cases
      if (text === "no_results" || text === "error") {
        return;
      }

      // Find the bookmark by URL
      const bookmark = Object.values(this.bookmarks).find(
        (b) => b.url === text
      );

      // Track bookmark click if found
      if (bookmark) {
        await this.storageService.trackBookmarkClick(bookmark.id);
      }

      // Determine how to open the URL based on disposition
      switch (disposition) {
        case "currentTab":
          chrome.tabs.update({ url: text });
          break;
        case "newForegroundTab":
          chrome.tabs.create({ url: text });
          break;
        case "newBackgroundTab":
          chrome.tabs.create({ url: text, active: false });
          break;
        default:
          chrome.tabs.update({ url: text });
          break;
      }
    } catch (error) {
      console.error("Error in omnibox input entered handler:", error);
    }
  }

  /**
   * Load all bookmarks and workspaces from storage
   */
  private async loadData(): Promise<void> {
    try {
      this.bookmarks = await this.storageService.getBookmarks();
      this.workspaces = await this.storageService.getWorkspaces();
    } catch (error) {
      console.error("Error loading data for omnibox search:", error);
      throw error;
    }
  }

  /**
   * Search bookmarks using simple string matching first
   */
  private searchBookmarks(query: string): SearchMatch[] {
    const bookmarksArray = Object.values(this.bookmarks);
    const searchQuery = query.toLowerCase().trim();

    // Filter bookmarks that match the query
    const matchedBookmarks = bookmarksArray.filter((bookmark) => {
      const titleMatch = bookmark.title.toLowerCase().includes(searchQuery);
      const urlMatch = bookmark.url.toLowerCase().includes(searchQuery);
      return titleMatch || urlMatch;
    });

    // Sort by relevance (title matches first, then URL matches)
    matchedBookmarks.sort((a, b) => {
      const aTitleMatch = a.title.toLowerCase().includes(searchQuery);
      const bTitleMatch = b.title.toLowerCase().includes(searchQuery);

      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;

      return a.title.localeCompare(b.title);
    });

    // Convert to SearchMatch format
    return matchedBookmarks
      .map((bookmark) => {
        const titleIndex = bookmark.title.toLowerCase().indexOf(searchQuery);
        const urlIndex = bookmark.url.toLowerCase().indexOf(searchQuery);

        const matches: SearchMatch["matchPositions"] = [];

        if (titleIndex !== -1) {
          matches.push({
            fieldName: "title",
            indices: [[titleIndex, searchQuery.length]],
          });
        }

        if (urlIndex !== -1) {
          matches.push({
            fieldName: "url",
            indices: [[urlIndex, searchQuery.length]],
          });
        }

        // Truncate and clean the URL for display
        const displayUrl = this.truncateUrl(bookmark.url);

        return {
          item: {
            ...bookmark,
            displayUrl, // Add this new property for display purposes
          },
          matchPositions: matches,
        };
      })
      .slice(0, MAX_SUGGESTIONS);
  }

  // Add this new method to escape XML special characters
  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "&lt;":
          return "&lt;";
        case "&gt;":
          return "&gt;";
        case "&amp;":
          return "&amp;";
        case "'":
          return "&apos;";
        case '"':
          return "&quot;";
        default:
          return c;
      }
    });
  }

  // Add this new method to truncate and clean URLs
  private truncateUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      let cleanUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
      if (cleanUrl.length > 50) {
        cleanUrl = cleanUrl.substring(0, 47) + "...";
      }
      return cleanUrl;
    } catch (error) {
      console.error("Error parsing URL:", error);
      return url.length > 50 ? url.substring(0, 47) + "..." : url;
    }
  }
}

export default OmniboxService;
