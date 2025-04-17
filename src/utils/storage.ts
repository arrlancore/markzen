import { Bookmark, Column, BookmarkStats } from "../models/bookmark";
import { Workspace, WorkspaceSettings } from "../models/workspace";

// Define keys for storage to use as type-safe indices
export type StorageKey =
  | "bookmarks"
  | "columns"
  | "workspaces"
  | "bookmarkStats"
  | "workspaceSettings"
  | "settings";

export interface StorageData {
  bookmarks: Record<string, Bookmark>;
  columns: Record<string, Column>;
  workspaces: Record<string, Workspace>;
  bookmarkStats: Record<string, BookmarkStats>;
  workspaceSettings: WorkspaceSettings;
  settings: AppSettings;
}
export interface AppSettings {
  theme: "light" | "dark" | "system";
  storageType: "local" | "sync"; // New setting for storage type
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
  storageType: "local", // Default to local storage
  newtabBackground: "image",
  showClock: true,
  showDate: true,
  showTopBookmarks: true,
  topBookmarksCount: 3,
  showFavicons: true,
};

const defaultWorkspaceSettings: WorkspaceSettings = {
  defaultWorkspaceId: "default",
  lastVisitedWorkspaceId: "default",
};

class StorageService {
  private activeStorage: chrome.storage.StorageArea = chrome.storage.local;

  // Initialize the storage service with the correct storage type
  async initialize(): Promise<void> {
    let settings = await this.getSettings();
    if (!settings.storageType) {
      // Default to local storage if storage type is not set
      this.set("settings", {
        ...settings,
        storageType: "local",
      } as AppSettings);

      settings = await this.getSettings();
    }
    this.setStorageType(settings.storageType);
  }

  // Set the active storage type
  setStorageType(type: "local" | "sync"): void {
    this.activeStorage =
      type === "local" ? chrome.storage.local : chrome.storage.sync;
  }

  // Get the current storage type
  async getStorageType(): Promise<"local" | "sync"> {
    // First try to get settings from both locations to determine which is active
    const localSettings = await new Promise<AppSettings | undefined>(
      (resolve) => {
        chrome.storage.local.get(["settings"], (result) => {
          resolve(result.settings as AppSettings | undefined);
        });
      }
    );

    const syncSettings = await new Promise<AppSettings | undefined>(
      (resolve) => {
        chrome.storage.sync.get(["settings"], (result) => {
          resolve(result.settings as AppSettings | undefined);
        });
      }
    );

    // Logic to determine which storage is actually active
    if (syncSettings && syncSettings.storageType === "sync") {
      // If sync settings exist and indicate sync storage, use sync
      console.log("Verified sync storage is active based on sync settings");
      this.setStorageType("sync");
      return "sync";
    } else if (localSettings && localSettings.storageType === "local") {
      // If local settings exist and indicate local storage, use local
      console.log("Verified local storage is active based on local settings");
      this.setStorageType("local");
      return "local";
    } else if (syncSettings) {
      // If only sync settings exist, use sync regardless of what it says
      console.log("Using sync storage because settings only exist there");
      this.setStorageType("sync");
      return "sync";
    } else if (localSettings) {
      // If only local settings exist, use local regardless of what it says
      console.log("Using local storage because settings only exist there");
      this.setStorageType("local");
      return "local";
    }

    // Default to local if nothing found
    console.log("No settings found in either storage, defaulting to local");
    this.setStorageType("local");
    return "local";
  }

  // Helper method to get data from Chrome storage
  private async get<T>(key: keyof StorageData): Promise<T | undefined> {
    return new Promise((resolve) => {
      this.activeStorage.get([key], (result) => {
        resolve(result[key] as T);
      });
    });
  }

  // Helper method to set data in Chrome storage
  private async set<T>(key: keyof StorageData, value: T): Promise<void> {
    return new Promise((resolve) => {
      this.activeStorage.set({ [key]: value }, resolve);
    });
  }

  /**
   * Migrate data between storage types
   * This function handles transferring data from one storage area to another
   * while ensuring no duplication between storage areas
   */
  async migrateStorage(newType: "local" | "sync"): Promise<void> {
    const currentType = await this.getStorageType();
    if (currentType === newType) {
      return; // No migration needed
    }

    const sourceStorage = this.activeStorage;
    const targetStorage =
      newType === "local" ? chrome.storage.local : chrome.storage.sync;

    try {
      // Get all data from current storage
      const data = await new Promise<Record<string, any>>((resolve) => {
        sourceStorage.get(null, (items) => {
          resolve(items);
        });
      });

      // If no data found, nothing to migrate
      if (Object.keys(data).length === 0) {
        this.setStorageType(newType);
        return;
      }

      // Check if the data size is within sync storage limits if migrating to sync
      if (newType === "sync") {
        const jsonSize = JSON.stringify(data).length;
        if (jsonSize > 100 * 1024) {
          // 100KB limit for sync storage
          throw new Error(
            "Data exceeds sync storage limit (100KB). Please reduce your data or use local storage."
          );
        }
      }

      // Set all data in new storage
      await new Promise<void>((resolve, reject) => {
        targetStorage.set(data, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      // Update active storage
      this.setStorageType(newType);

      // Update settings to reflect the new storage type
      const settings = await this.getSettings();

      // Update settings in the new storage area directly
      await new Promise<void>((resolve) => {
        targetStorage.set(
          { settings: { ...settings, storageType: newType } },
          resolve
        );
      });

      // Clear the data from the previous storage to avoid duplication
      await new Promise<void>((resolve) => {
        sourceStorage.clear(resolve);
      });
    } catch (error) {
      throw new Error(`Migration failed: ${(error as Error).message}`);
    }
  }

  // Get all settings
  async getSettings(): Promise<AppSettings> {
    // Always check both storage types for settings
    return new Promise((resolve) => {
      chrome.storage.local.get(["settings"], (localResult) => {
        if (localResult.settings) {
          resolve(localResult.settings as AppSettings);
        } else {
          chrome.storage.sync.get(["settings"], (syncResult) => {
            if (syncResult.settings) {
              resolve(syncResult.settings as AppSettings);
            } else {
              resolve(defaultSettings);
            }
          });
        }
      });
    });
  }

  // Update settings
  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const currentSettings = await this.getSettings();
    const updatedSettings = { ...currentSettings, ...settings };

    // If we're changing storage type, update before saving settings
    if (
      settings.storageType &&
      settings.storageType !== currentSettings.storageType
    ) {
      await this.migrateStorage(settings.storageType);
    }

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
    // First determine the correct storage type
    const storageType = await this.getStorageType();
    this.setStorageType(storageType);

    // Try to get workspaces from the active storage
    const workspaces = await this.get<Record<string, Workspace>>("workspaces");

    // Before creating defaults, check both storage locations
    if (!workspaces || Object.keys(workspaces).length === 0) {
      // Check sync storage if we're on local
      if (storageType === "local") {
        const syncWorkspaces = await new Promise<
          Record<string, Workspace> | undefined
        >((resolve) => {
          chrome.storage.sync.get(["workspaces"], (result) => {
            resolve(result.workspaces);
          });
        });

        if (syncWorkspaces && Object.keys(syncWorkspaces).length > 0) {
          // If found in sync, use that data and migrate it to local
          await this.migrateStorage("local");
          return syncWorkspaces;
        }
      }

      // Check local storage if we're on sync
      if (storageType === "sync") {
        const localWorkspaces = await new Promise<
          Record<string, Workspace> | undefined
        >((resolve) => {
          chrome.storage.local.get(["workspaces"], (result) => {
            resolve(result.workspaces);
          });
        });

        if (localWorkspaces && Object.keys(localWorkspaces).length > 0) {
          // If found in local, use that data and migrate it to sync
          await this.migrateStorage("sync");
          return localWorkspaces;
        }
      }

      // If no data found in either location, create defaults
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

      // Save to the correct storage area
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
