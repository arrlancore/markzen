import { StorageService } from "@/utils/storage";
import { AnalyticsService } from "@/utils/analytics";

export class RootService {
  readonly storage: StorageService;
  readonly analytics: AnalyticsService;
  private static instance: RootService;
  private isInitialized = false;

  private constructor() {
    this.storage = new StorageService();
    this.analytics = new AnalyticsService(this.storage);
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
      await this.storage.initialize();
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
