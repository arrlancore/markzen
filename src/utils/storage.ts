import { Bookmark, Column, BookmarkStats } from "../models/bookmark";
import { Workspace, WorkspaceSettings } from "../models/workspace";

export interface StorageData {
  bookmarks: Record<string, Bookmark>;
  columns: Record<string, Column>;
  workspaces: Record<string, Workspace>;
  bookmarkStats: Record<string, BookmarkStats>;
  workspaceSettings: WorkspaceSettings;
  settings: AppSettings;
}

// Update this in src/utils/storage.ts

export interface AppSettings {
  theme: "light" | "dark" | "system";
  // Keep these properties for backward compatibility
  // but we won't expose them in the UI anymore
  newtabBackground: "color" | "image" | "unsplash";
  unsplashCategory?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  showClock: boolean;
  showDate: boolean;
  showTopBookmarks: boolean;
  topBookmarksCount: number;
  showFavicons: boolean;
}

const defaultSettings: AppSettings = {
  theme: "system",
  newtabBackground: "image",
  showClock: true,
  showDate: true,
  showTopBookmarks: true,
  topBookmarksCount: 3, // Changed from 10 to 3 to match the actual implementation
  showFavicons: true,
};

const defaultWorkspaceSettings: WorkspaceSettings = {
  defaultWorkspaceId: "default",
  lastVisitedWorkspaceId: "default",
};

class StorageService {
  // Helper method to get data from Chrome storage
  private async get<T>(key: keyof StorageData): Promise<T | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] as T);
      });
    });
  }

  // Helper method to set data in Chrome storage
  private async set<T>(key: keyof StorageData, value: T): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  // Get all settings
  async getSettings(): Promise<AppSettings> {
    const settings = await this.get<AppSettings>("settings");
    return settings || defaultSettings;
  }

  // Update settings
  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const currentSettings = await this.getSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    await this.set("settings", updatedSettings);
    return updatedSettings;
  }

  // Get all bookmarks
  async getBookmarks(): Promise<Record<string, Bookmark>> {
    const bookmarks = await this.get<Record<string, Bookmark>>("bookmarks");
    return bookmarks || {};
  }

  // Get a single bookmark
  async getBookmark(id: string): Promise<Bookmark | undefined> {
    const bookmarks = await this.getBookmarks();
    return bookmarks[id];
  }

  // Save a bookmark
  async saveBookmark(bookmark: Bookmark): Promise<void> {
    const bookmarks = await this.getBookmarks();
    bookmarks[bookmark.id] = bookmark;
    await this.set("bookmarks", bookmarks);
  }

  // Delete a bookmark
  async deleteBookmark(id: string): Promise<void> {
    const bookmarks = await this.getBookmarks();
    delete bookmarks[id];
    await this.set("bookmarks", bookmarks);
  }

  // Get all columns
  async getColumns(workspaceId?: string): Promise<Record<string, Column>> {
    const columns = await this.get<Record<string, Column>>("columns");
    if (workspaceId) {
      return Object.values(columns || {})
        .filter((column) => column.workspaceId === workspaceId)
        .reduce((acc, column) => {
          acc[column.id] = column;
          return acc;
        }, {} as Record<string, Column>);
    }

    return columns || {};
  }

  // Get columns for a workspace
  async getWorkspaceColumns(workspaceId: string): Promise<Column[]> {
    const columns = await this.getColumns();
    return Object.values(columns)
      .filter((column) => column.workspaceId === workspaceId)
      .sort((a, b) => a.order - b.order);
  }

  // Save a column
  async saveColumn(column: Column): Promise<void> {
    const columns = await this.getColumns();
    columns[column.id] = column;
    await this.set("columns", columns);
  }

  async getColumn(id: string): Promise<Column | undefined> {
    const columns = await this.getColumns();
    return columns[id];
  }

  // Delete a column
  async deleteColumn(id: string): Promise<void> {
    const columns = await this.getColumns();
    delete columns[id];
    await this.set("columns", columns);
  }

  // Get all workspaces
  async getWorkspaces(): Promise<Record<string, Workspace>> {
    const workspaces = await this.get<Record<string, Workspace>>("workspaces");

    // If no workspaces exist, create a default one
    if (!workspaces || Object.keys(workspaces).length === 0) {
      const defaultColumns: Column[] = [
        {
          id: "to-read",
          title: "To Read",
          bookmarkIds: [],
          workspaceId: "default",
          createdAt: new Date().toISOString(),
          order: 0,
        },
        {
          id: "reading",
          title: "Reading",
          bookmarkIds: [],
          workspaceId: "default",
          createdAt: new Date().toISOString(),
          order: 1,
        },
        {
          id: "completed",
          title: "Completed",
          bookmarkIds: [],
          workspaceId: "default",
          createdAt: new Date().toISOString(),
          order: 2,
        },
      ];
      const defaultWorkspace: Workspace = {
        id: "default",
        name: "Default",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        columnIds: defaultColumns.map((column) => column.id),
      };

      // Save default columns
      const columnsObj = defaultColumns.reduce((acc, column) => {
        acc[column.id] = column;
        return acc;
      }, {} as Record<string, Column>);
      await this.set("columns", columnsObj);

      await this.set("workspaces", { default: defaultWorkspace });
      return { default: defaultWorkspace };
    }

    return workspaces;
  }

  // Get a single workspace
  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const workspaces = await this.getWorkspaces();
    return workspaces[id];
  }

  // Save a workspace
  async saveWorkspace(workspace: Workspace): Promise<void> {
    const workspaces = await this.getWorkspaces();
    workspaces[workspace.id] = workspace;
    await this.set("workspaces", workspaces);
  }

  // Delete a workspace
  async deleteWorkspace(id: string): Promise<void> {
    const workspaces = await this.getWorkspaces();
    delete workspaces[id];
    await this.set("workspaces", workspaces);
  }

  // Get workspace settings
  async getWorkspaceSettings(): Promise<WorkspaceSettings> {
    const settings = await this.get<WorkspaceSettings>("workspaceSettings");
    return settings || defaultWorkspaceSettings;
  }

  async getActiveWorkspaceId(): Promise<string> {
    const settings = await this.getWorkspaceSettings();
    return settings.lastVisitedWorkspaceId || "default";
  }

  // Update workspace settings
  async updateWorkspaceSettings(
    settings: Partial<WorkspaceSettings>
  ): Promise<WorkspaceSettings> {
    const currentSettings = await this.getWorkspaceSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    await this.set("workspaceSettings", updatedSettings);
    return updatedSettings;
  }

  // Get bookmark stats
  async getBookmarkStats(): Promise<Record<string, BookmarkStats>> {
    const stats = await this.get<Record<string, BookmarkStats>>(
      "bookmarkStats"
    );
    return stats || {};
  }

  // Track bookmark click
  async trackBookmarkClick(bookmarkId: string): Promise<void> {
    const stats = await this.getBookmarkStats();

    if (!stats[bookmarkId]) {
      stats[bookmarkId] = {
        id: bookmarkId,
        clicks: 0,
        lastClicked: new Date().toISOString(),
      };
    }

    stats[bookmarkId].clicks++;
    stats[bookmarkId].lastClicked = new Date().toISOString();

    await this.set("bookmarkStats", stats);
  }

  // Get most used bookmarks
  async getMostUsedBookmarks(
    limit: number = 10
  ): Promise<{ bookmark: Bookmark; stats: BookmarkStats }[]> {
    const bookmarks = await this.getBookmarks();
    const stats = await this.getBookmarkStats();

    // Create an array of bookmarks with their stats
    const bookmarksWithStats = Object.values(bookmarks)
      .filter((bookmark) => stats[bookmark.id])
      .map((bookmark) => ({
        bookmark,
        stats: stats[bookmark.id],
      }))
      .sort((a, b) => b.stats.clicks - a.stats.clicks)
      .slice(0, limit);

    return bookmarksWithStats;
  }

  // Initialize default data if needed
  async initializeDefaultData(): Promise<void> {
    const workspaces = await this.getWorkspaces();

    // If no workspaces exist, create default workspace and columns
    if (Object.keys(workspaces).length === 0) {
      const defaultWorkspace: Workspace = {
        id: "default",
        name: "Default",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        columnIds: ["to-read", "reading", "completed"],
      };

      const defaultColumns: Column[] = [
        {
          id: "to-read",
          title: "To Read",
          bookmarkIds: [],
          workspaceId: "default",
          createdAt: new Date().toISOString(),
          order: 0,
        },
        {
          id: "reading",
          title: "Reading",
          bookmarkIds: [],
          workspaceId: "default",
          createdAt: new Date().toISOString(),
          order: 1,
        },
        {
          id: "completed",
          title: "Completed",
          bookmarkIds: [],
          workspaceId: "default",
          createdAt: new Date().toISOString(),
          order: 2,
        },
      ];

      // Save default workspace and columns
      await this.saveWorkspace(defaultWorkspace);

      const columnsObj = defaultColumns.reduce((acc, column) => {
        acc[column.id] = column;
        return acc;
      }, {} as Record<string, Column>);

      await this.set("columns", columnsObj);

      // Set default workspace settings
      await this.updateWorkspaceSettings({
        defaultWorkspaceId: "default",
        lastVisitedWorkspaceId: "default",
      });
    }
  }
}

export const storageService = new StorageService();
export default storageService;
