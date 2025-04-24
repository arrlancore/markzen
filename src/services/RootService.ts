import { StorageService } from "@/utils/storage";
import { AnalyticsService } from "@/utils/analytics";
import OmniboxService from "./OmniboxService";

export class RootService {
  readonly storage: StorageService;
  readonly analytics: AnalyticsService;
  readonly omnibox: OmniboxService;
  private static instance: RootService;
  private isInitialized = false;

  private constructor() {
    this.storage = new StorageService();
    this.analytics = new AnalyticsService(this.storage);
    this.omnibox = new OmniboxService(this.storage);
  }

  static getInstance(): RootService {
    if (!RootService.instance) {
      RootService.instance = new RootService();
    }
    return RootService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize storage first
      await this.storage.initialize();
      await this.storage.initializeDefaultData();

      // Initialize omnibox service if in a context with chrome.omnibox available
      // (Only in background script, not in content scripts or popup)
      if (typeof chrome !== 'undefined' && chrome.omnibox) {
        try {
          await this.omnibox.initialize();
          console.log("Omnibox service initialized successfully");
        } catch (omniboxError) {
          // Non-critical error, just log it
          console.error("Omnibox initialization failed:", omniboxError);
        }
      }

      this.isInitialized = true;
      console.log("RootService initialized successfully");
    } catch (error) {
      console.error("RootService initialization failed:", error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const rootService = RootService.getInstance();
export default rootService;
