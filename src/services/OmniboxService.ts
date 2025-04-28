// OmniboxService.ts
// Service to handle omnibox search functionality for the extension

import { Bookmark } from "../models/bookmark";
import { Workspace } from "../models/workspace";
import { StorageService } from "../utils/storage";
import { fuzzySearch, SearchMatch } from "../utils/fuzzy-search";

// Maximum number of suggestions to show in omnibox
const MAX_SUGGESTIONS = 8;

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

        // Generate highlighted title and URL
        const highlightedTitle = this.generateHighlightedText(
          bookmark.title,
          result.matchPositions.find(m => m.fieldName === "title")?.indices || []
        );

        const truncatedUrl = this.truncateUrl(bookmark.url);
        const highlightedUrl = this.generateHighlightedText(
          truncatedUrl,
          result.matchPositions.find(m => m.fieldName === "url")?.indices || []
        );

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
              "No bookmarks found matching: <match>" + this.escapeXml(text) + "</match>",
            deletable: false,
          },
        ]);
        return;
      }

      // Provide suggestions
      suggest(suggestions);
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
   * Generate highlighted text with match tags for omnibox display
   */
  private generateHighlightedText(text: string, matches: Array<[number, number]>): string {
    if (!matches.length) {
      return this.escapeXml(text);
    }

    // Sort matches by start position
    const sortedMatches = [...matches].sort((a, b) => a[0] - b[0]);

    let result = '';
    let lastIndex = 0;

    for (const [start, length] of sortedMatches) {
      // Add text before match
      if (start > lastIndex) {
        result += this.escapeXml(text.substring(lastIndex, start));
      }

      // Add highlighted match
      result += '<match>' + this.escapeXml(text.substring(start, start + length)) + '</match>';

      lastIndex = start + length;
    }

    // Add remaining text after last match
    if (lastIndex < text.length) {
      result += this.escapeXml(text.substring(lastIndex));
    }

    return result;
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
   * Search bookmarks using fuzzy search
   */
  private searchBookmarks(query: string): SearchMatch[] {
    const bookmarksArray = Object.values(this.bookmarks);

    // Use our new fuzzy search function
    return fuzzySearch(bookmarksArray, query, MAX_SUGGESTIONS);
  }

  // Escape XML special characters
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&apos;")
      .replace(/"/g, "&quot;");
  }

  // Truncate and clean URLs
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
