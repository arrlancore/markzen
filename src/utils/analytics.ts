import { Bookmark } from "../models/bookmark";
import { StorageService } from "./storage";

export class AnalyticsService {
  constructor(private storageService: StorageService) {}

  async trackBookmarkClick(bookmarkId: string): Promise<void> {
    await this.storageService.trackBookmarkClick(bookmarkId);

    const bookmark = await this.storageService.getBookmark(bookmarkId);
    if (bookmark) {
      await this.storageService.saveBookmark({
        ...bookmark,
        lastVisited: new Date().toISOString(),
      });
    }
  }

  // Get the most frequently used bookmarks
  async getMostUsedBookmarks(
    limit: number = 10
  ): Promise<{ bookmark: Bookmark; clicks: number }[]> {
    const bookmarksWithStats = await this.storageService.getMostUsedBookmarks(
      limit
    );

    return bookmarksWithStats.map((item) => ({
      bookmark: item.bookmark,
      clicks: item.stats.clicks,
    }));
  }

  // Get recently used bookmarks
  async getRecentlyUsedBookmarks(limit: number = 10): Promise<Bookmark[]> {
    const bookmarks = await this.storageService.getBookmarks();

    return Object.values(bookmarks)
      .filter((bookmark) => bookmark.lastVisited) // Only include bookmarks that have been visited
      .sort((a, b) => {
        const dateA = a.lastVisited ? new Date(a.lastVisited).getTime() : 0;
        const dateB = b.lastVisited ? new Date(b.lastVisited).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  // Get the distribution of bookmarks across workspaces
  async getBookmarkDistribution(): Promise<Record<string, number>> {
    const bookmarks = await this.storageService.getBookmarks();
    const workspaces = await this.storageService.getWorkspaces();

    const distribution: Record<string, number> = {};

    // Initialize all workspaces with 0 bookmarks
    Object.keys(workspaces).forEach((workspaceId) => {
      distribution[workspaceId] = 0;
    });

    // Count bookmarks per workspace
    Object.values(bookmarks).forEach((bookmark) => {
      if (distribution[bookmark.workspaceId] !== undefined) {
        distribution[bookmark.workspaceId]++;
      }
    });

    return distribution;
  }

  // Get usage patterns over time (simplified)
  async getUsageOverTime(days: number = 7): Promise<Record<string, number>> {
    const stats = await this.storageService.getBookmarkStats();
    const now = new Date();
    const result: Record<string, number> = {};

    // Initialize all days with 0 clicks
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split("T")[0];
      result[dateString] = 0;
    }

    // Count clicks per day
    Object.values(stats).forEach((stat) => {
      const clickDate = new Date(stat.lastClicked).toISOString().split("T")[0];
      if (result[clickDate] !== undefined) {
        result[clickDate] += 1;
      }
    });

    return result;
  }
}

export const analyticsService = new AnalyticsService(new StorageService());
export default analyticsService;
