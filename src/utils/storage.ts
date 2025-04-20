// src/utils/storage.ts
import { Bookmark, Column, BookmarkStats } from "../models/bookmark";
import { Workspace, WorkspaceSettings } from "../models/workspace";

console.log("Storage service loaded");

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
  storageType: "local" | "sync";
  // Keep existing settings
  newtabBackground: "color" | "image" | "unsplash";
  unsplashCategory?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  showClock: boolean;
  showDate: boolean;
  showTopBookmarks: boolean;
  topBookmarksCount: number;
  showFavicons: boolean;
  bookmarkExpirationDays: number | "never";
}

// Update the defaultSettings object
const defaultSettings: AppSettings = {
  theme: "system",
  storageType: "local",
  newtabBackground: "image",
  showClock: true,
  showDate: true,
  showTopBookmarks: true,
  topBookmarksCount: 3,
  showFavicons: true,
  bookmarkExpirationDays: 90,
};

const defaultWorkspaceSettings: WorkspaceSettings = {
  defaultWorkspaceId: "default",
  lastVisitedWorkspaceId: "default",
};

interface IStorageService {
  // Initialization and configuration
  initialize(): Promise<void>;
  setStorageType(type: "local" | "sync"): void;
  getStorageType(): Promise<"local" | "sync">;
  migrateStorage(newType: "local" | "sync"): Promise<void>;

  // Settings management
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;

  // Bookmark operations
  getBookmarks(): Promise<Record<string, Bookmark>>;
  getBookmark(id: string): Promise<Bookmark | undefined>;
  saveBookmark(bookmark: Bookmark): Promise<void>;
  deleteBookmark(id: string): Promise<void>;

  // Column operations
  getColumns(workspaceId?: string): Promise<Record<string, Column>>;
  getWorkspaceColumns(workspaceId: string): Promise<Column[]>;
  saveColumn(column: Column): Promise<void>;
  getColumn(id: string): Promise<Column | undefined>;
  deleteColumn(id: string): Promise<void>;

  // Workspace operations
  getWorkspaces(): Promise<Record<string, Workspace>>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  getWorkspaceSettings(): Promise<WorkspaceSettings>;
  getActiveWorkspaceId(): Promise<string>;
  updateWorkspaceSettings(
    settings: Partial<WorkspaceSettings>
  ): Promise<WorkspaceSettings>;
  switchWorkspace(workspaceId: string): Promise<void>;

  // Bookmark statistics
  getBookmarkStats(): Promise<Record<string, BookmarkStats>>;
  trackBookmarkClick(bookmarkId: string): Promise<void>;
  getMostUsedBookmarks(
    limit?: number
  ): Promise<{ bookmark: Bookmark; stats: BookmarkStats }[]>;

  // Default data management
  initializeDefaultData(): Promise<void>;

  // Default opens management
  removeDefaultOpen(workspaceId: string, bookmarkId: string): Promise<void>;
  getDefaultOpens(workspaceId: string): Promise<Bookmark[]>;
  reorderDefaultOpens(workspaceId: string, newOrder: string[]): Promise<void>;
  openDefaultBookmarks(
    workspaceId: string,
    inNewWindow?: boolean
  ): Promise<void>;
}

export class StorageService implements IStorageService {
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

  private activeStorage: chrome.storage.StorageArea = chrome.storage.local;

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
  setStorageType(type: "local" | "sync"): void {
    this.activeStorage =
      type === "local" ? chrome.storage.local : chrome.storage.sync;
  }
  getStorageType(): Promise<"local" | "sync"> {
    return new Promise((resolve) => {
      this.activeStorage.get(["settings"], (result) => {
        const settings = result.settings as AppSettings;
        resolve(settings.storageType);
      });
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
    const workspaces = await this.get<Record<string, Workspace>>("workspaces");
    return workspaces || {};
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

  async switchWorkspace(workspaceId: string): Promise<void> {
    const workspaces = await this.getWorkspaces();
    const workspace = workspaces[workspaceId];
    if (!workspace) {
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }
    await this.updateWorkspaceSettings({
      lastVisitedWorkspaceId: workspaceId,
    });
    await this.updateWorkspaceColumns(workspaceId);
    // Update the active workspace ID in the settings
    await this.set("workspaceSettings", {
      ...workspace,
      lastVisitedWorkspaceId: workspaceId,
    });
  }

  // Update workspace columns
  async updateWorkspaceColumns(workspaceId: string): Promise<void> {
    const columns = await this.getColumns(workspaceId);
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }
    const updatedColumns = Object.values(columns).map((column) => ({
      ...column,
      workspaceId,
    }));
    await Promise.all(updatedColumns.map((column) => this.saveColumn(column)));
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
  async initializeDefaultData(): Promise<void> {
    try {
      const workspaces = await this.getWorkspaces();

      // If no workspaces exist, create default workspace and columns
      if (!workspaces || Object.keys(workspaces).length === 0) {
        console.log("No workspaces found, creating defaults...");

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
        await this.set("workspaces", { default: defaultWorkspace });

        const columnsObj = defaultColumns.reduce((acc, column) => {
          acc[column.id] = column;
          return acc;
        }, {} as Record<string, Column>);

        await this.set("columns", columnsObj);

        // Set default workspace settings
        await this.set("workspaceSettings", {
          defaultWorkspaceId: "default",
          lastVisitedWorkspaceId: "default",
        });

        console.log("Default data created successfully");
      }
    } catch (error) {
      console.error("Failed to initialize default data:", error);
      throw error;
    }
  }

  /**
   * Remove a bookmark from the default opens for a workspace
   * @param workspaceId The ID of the workspace
   * @param bookmarkId The ID of the bookmark to remove
   */
  async removeDefaultOpen(
    workspaceId: string,
    bookmarkId: string
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace || !workspace.defaultOpenIds) {
      return; // Nothing to remove
    }

    // Remove from default opens
    workspace.defaultOpenIds = workspace.defaultOpenIds.filter(
      (id) => id !== bookmarkId
    );
    workspace.updatedAt = new Date().toISOString();

    // Save workspace
    await this.saveWorkspace(workspace);
  }
  /**
   * Get all default opens for a workspace
   * @param workspaceId The ID of the workspace
   * @returns Array of bookmarks that are default opens
   */
  async getDefaultOpens(workspaceId: string): Promise<Bookmark[]> {
    const workspace = await this.getWorkspace(workspaceId);
    if (
      !workspace ||
      !workspace.defaultOpenIds ||
      workspace.defaultOpenIds.length === 0
    ) {
      return []; // No default opens
    }
    const bookmarks = await this.getBookmarks();
    return workspace.defaultOpenIds.map((id) => bookmarks[id]);
  }
  /**
   * Reorder default opens for a workspace
   * @param workspaceId The ID of the workspace
   * @param newOrder Array of bookmark IDs in the new order
   */
  async reorderDefaultOpens(
    workspaceId: string,
    newOrder: string[]
  ): Promise<void> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // Validate that newOrder contains valid bookmark IDs
    const bookmarks = await this.getBookmarks();
    const invalidIds = newOrder.filter((id) => !bookmarks[id]);
    if (invalidIds.length > 0) {
      throw new Error(`Invalid bookmark IDs: ${invalidIds.join(", ")}`);
    }

    // Update default opens order
    workspace.defaultOpenIds = newOrder;
    workspace.updatedAt = new Date().toISOString();

    // Save workspace
    await this.saveWorkspace(workspace);
  }

  /**
   * Open all default bookmarks for a workspace
   * @param workspaceId The ID of the workspace
   * @param inNewWindow Whether to open in a new window
   */
  async openDefaultBookmarks(
    workspaceId: string,
    inNewWindow: boolean = false
  ): Promise<void> {
    const defaultOpens = await this.getDefaultOpens(workspaceId);

    if (defaultOpens.length === 0) {
      throw new Error("No default opens found");
    }

    // Track analytics for each bookmark
    for (const bookmark of defaultOpens) {
      await this.trackBookmarkClick(bookmark.id);
    }

    // Extract URLs
    const urls = defaultOpens.map((bookmark) => bookmark.url);

    // Open in new window or tabs
    if (inNewWindow) {
      // Open first URL in new window, then add tabs to that window
      return new Promise<void>((resolve, reject) => {
        chrome.windows.create({ url: urls[0] }, (window) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          // Add the rest of the URLs as tabs in the new window
          const remainingUrls = urls.slice(1);
          if (remainingUrls.length > 0 && window && window.id) {
            let tabsCreated = 0;

            // Create tabs with a small delay between each for better performance
            remainingUrls.forEach((url, index) => {
              setTimeout(() => {
                chrome.tabs.create({ url, windowId: window.id }, (tab) => {
                  tabsCreated++;
                  if (tabsCreated === remainingUrls.length) {
                    resolve();
                  }
                });
              }, index * 100); // 100ms delay between each tab creation
            });
          } else {
            resolve();
          }
        });
      });
    } else {
      // Open in current window as new tabs
      return new Promise<void>((resolve) => {
        let tabsCreated = 0;

        // Create tabs with a small delay between each for better performance
        urls.forEach((url, index) => {
          setTimeout(() => {
            chrome.tabs.create({ url }, (tab) => {
              tabsCreated++;
              if (tabsCreated === urls.length) {
                resolve();
              }
            });
          }, index * 100); // 100ms delay between each tab creation
        });
      });
    }
  }
}

// Create a singleton instance
export const storageService = new StorageService();
export default storageService;
