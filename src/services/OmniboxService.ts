// OmniboxService.ts
// Service to handle omnibox search functionality for the extension

import { Bookmark } from "../models/bookmark";
import { Workspace } from "../models/workspace";
import { fuzzySearch, formatTextWithHighlights } from "../utils/fuzzy-search";
import { StorageService } from "../utils/storage";

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
      chrome.omnibox.onInputStarted.addListener(this.handleInputStarted.bind(this));
      chrome.omnibox.onInputChanged.addListener(this.handleInputChanged.bind(this));
      chrome.omnibox.onInputEntered.addListener(this.handleInputEntered.bind(this));

      // Set default suggestion
      chrome.omnibox.setDefaultSuggestion({
        description: "Search your MarkZen bookmarks"
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
        description: "Search your MarkZen bookmarks"
      });
    } catch (error) {
      console.error("Error in omnibox input started handler:", error);
      chrome.omnibox.setDefaultSuggestion({
        description: "Error loading bookmarks: " + (error as Error).message
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
      const suggestions = results.map(result => {
        const bookmark = result.item;
        const workspace = this.workspaces[bookmark.workspaceId]?.name || "Unknown";

        // Format the title with highlights
        const titleMatches = result.matchPositions
          .filter(pos => pos.fieldName === 'title')
          .flatMap(pos => pos.indices);

        // For multi-word searches, highlight each word individually
        const isMultiWordSearch = text.trim().includes(' ');
        const matchLength = isMultiWordSearch ?
          // For multi-word, use the individual token lengths where possible
          Math.min(text.split(/\s+/)[0].length, text.length) :
          text.length;

        const formattedTitle = formatTextWithHighlights(
          bookmark.title,
          titleMatches,
          matchLength
        );

        // Format URL with highlights (truncated if needed)
        const urlMatches = result.matchPositions
          .filter(pos => pos.fieldName === 'url')
          .flatMap(pos => pos.indices);

        let displayUrl = bookmark.url;
        if (displayUrl.length > 50) {
          displayUrl = displayUrl.substring(0, 47) + '...';
        }

        const formattedUrl = formatTextWithHighlights(
          displayUrl,
          urlMatches,
          matchLength // Use the same matchLength variable for consistency
        );

        // Create description with title and URL
        const description = `${formattedTitle.description} <dim>(${workspace})</dim> <url>${formattedUrl.description}</url>`;

        return {
          content: bookmark.url,
          description,
          deletable: false
        };
      });

      // Add a hint suggestion if no matches found
      if (suggestions.length === 0) {
        suggest([{
          content: "no_results",
          description: "No bookmarks found matching: <match>" + text + "</match>",
          deletable: false
        }]);
        return;
      }

      // Provide suggestions
      suggest(suggestions.slice(0, MAX_SUGGESTIONS));
    } catch (error) {
      console.error("Error in omnibox input changed handler:", error);
      suggest([{
        content: "error",
        description: "Error searching bookmarks: " + (error as Error).message,
        deletable: false
      }]);
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
      const bookmark = Object.values(this.bookmarks).find(b => b.url === text);

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
  private searchBookmarks(query: string) {
    // Convert bookmarks object to array for searching
    const bookmarksArray = Object.values(this.bookmarks);

    // Determine if this is likely a multi-word search
    const isMultiWordSearch = query.trim().includes(' ');

    // Search with our fuzzy search utility
    return fuzzySearch(
      bookmarksArray,
      [
        { name: 'title', weight: 2.5 },  // Title is most important, boost further
        { name: 'url', weight: 0.7 },    // URL is next
        { name: 'description', weight: 0.4 }, // Description less important
      ],
      query,
      {
        limit: MAX_SUGGESTIONS,
        threshold: isMultiWordSearch ? 3 : 5 // Lower threshold for multi-word searches
      }
    );
  }
}

export default OmniboxService;
