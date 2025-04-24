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

        // Parse search tokens and determine highlighting approach
        const searchTokens = text.trim().split(/\s+/).filter(t => t.length > 0);
        const isMultiWordSearch = searchTokens.length > 1;

        // Calculate variable match length based on search tokens
        let matchLength = text.length; // Default for single word

        if (isMultiWordSearch) {
          // For multi-word searches, base highlight length on the average token length
          // but with a minimum to ensure visibility
          const avgTokenLength = searchTokens.reduce((sum, token) => sum + token.length, 0) / searchTokens.length;
          matchLength = Math.max(2, Math.ceil(avgTokenLength));
        }

        // Special case for short prefixes (like 1-2 character searches)
        const hasShortToken = searchTokens.some(token => token.length <= 2);
        if (hasShortToken) {
          // For short tokens, make sure we highlight at least 2-3 characters
          matchLength = Math.max(matchLength, 2);
        }

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

        // Also check for matches in description and tags for completeness
        const hasDescriptionMatch = result.matchPositions.some(pos => pos.fieldName === 'description');
        const hasTagMatch = result.matchPositions.some(pos => pos.fieldName === 'tags');

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
    const searchTokens = query.trim().split(/\s+/);
    const isMultiWordSearch = searchTokens.length > 1;

    // For partial word matching like "cloud prod my", we need an even lower threshold
    // The more words, the lower the threshold should be
    let threshold = 5; // Default for single word searches

    if (isMultiWordSearch) {
      // Base threshold of 3 for two words, then decrease further for more words
      threshold = Math.max(1, 3 - (searchTokens.length - 2) * 0.5);

      // If the query contains very short terms (1-2 chars), lower threshold further
      const hasShortTerms = searchTokens.some(token => token.length < 3);
      if (hasShortTerms) {
        threshold *= 0.8;
      }
    }

    // Search with our fuzzy search utility
    return fuzzySearch(
      bookmarksArray,
      [
        { name: 'title', weight: 3.0 },  // Title is most important, boost further (was 2.5)
        { name: 'url', weight: 0.7 },    // URL is next
        { name: 'description', weight: 0.4 }, // Description less important
        { name: 'tags', weight: 0.8 }    // Add tags as a searchable field
      ],
      query,
      {
        limit: MAX_SUGGESTIONS,
        threshold: threshold
      }
    );
  }
}

export default OmniboxService;
