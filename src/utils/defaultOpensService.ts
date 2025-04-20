import { Bookmark } from "../models/bookmark";
import storageService from "./storage";

class DefaultOpensService {
  // async addDefaultOpen(workspaceId: string, bookmarkId: string): Promise<void> {
  //   const workspace = await storageService.getWorkspace(workspaceId);
  //   if (!workspace) {
  //     throw new Error("Workspace not found");
  //   }
  //   // Initialize defaultOpenIds if it doesn't exist
  //   workspace.defaultOpenIds = workspace.defaultOpenIds || [];
  //   // Check if already in default opens
  //   if (workspace.defaultOpenIds.includes(bookmarkId)) {
  //     return; // Already in default opens, no action needed
  //   }
  //   // Check if limit reached
  //   if (workspace.defaultOpenIds.length >= 10) {
  //     throw new Error("Maximum number of default opens reached (10)");
  //   }
  //   // Add to default opens
  //   workspace.defaultOpenIds.push(bookmarkId);
  //   workspace.updatedAt = new Date().toISOString();
  //   // Save workspace
  //   await storageService.saveWorkspace(workspace);
  // }
  // async removeDefaultOpen(
  //   workspaceId: string,
  //   bookmarkId: string
  // ): Promise<void> {
  //   const workspace = await storageService.getWorkspace(workspaceId);
  //   if (!workspace || !workspace.defaultOpenIds) {
  //     return; // Nothing to remove
  //   }
  //   // Remove from default opens
  //   workspace.defaultOpenIds = workspace.defaultOpenIds.filter(
  //     (id) => id !== bookmarkId
  //   );
  //   workspace.updatedAt = new Date().toISOString();
  //   // Save workspace
  //   await storageService.saveWorkspace(workspace);
  // }
  // async getDefaultOpens(workspaceId: string): Promise<Bookmark[]> {
  //   const workspace = await storageService.getWorkspace(workspaceId);
  //   if (!workspace?.defaultOpenIds?.length) {
  //     return [];
  //   }
  //   const bookmarks = await storageService.getBookmarks();
  //   // Get all default open bookmarks and preserve their order
  //   const defaultOpens: Bookmark[] = [];
  //   for (const id of workspace.defaultOpenIds) {
  //     if (bookmarks[id]) {
  //       defaultOpens.push(bookmarks[id]);
  //     }
  //   }
  //   return defaultOpens;
  // }
  // async reorderDefaultOpens(
  //   workspaceId: string,
  //   newOrder: string[]
  // ): Promise<void> {
  //   const workspace = await storageService.getWorkspace(workspaceId);
  //   if (!workspace) {
  //     throw new Error("Workspace not found");
  //   }
  //   // Validate that newOrder contains valid bookmark IDs
  //   const bookmarks = await storageService.getBookmarks();
  //   const invalidIds = newOrder.filter((id) => !bookmarks[id]);
  //   if (invalidIds.length > 0) {
  //     throw new Error(`Invalid bookmark IDs: ${invalidIds.join(", ")}`);
  //   }
  //   // Update default opens order
  //   workspace.defaultOpenIds = newOrder;
  //   workspace.updatedAt = new Date().toISOString();
  //   // Save workspace
  //   await storageService.saveWorkspace(workspace);
  // }
  // async openDefaultBookmarks(
  //   workspaceId: string,
  //   inNewWindow: boolean = false
  // ): Promise<void> {
  //   const defaultOpens = await this.getDefaultOpens(workspaceId);
  //   if (defaultOpens.length === 0) {
  //     throw new Error("No default opens found");
  //   }
  //   // Track analytics for each bookmark
  //   for (const bookmark of defaultOpens) {
  //     await storageService.trackBookmarkClick(bookmark.id);
  //   }
  //   const urls = defaultOpens.map((bookmark) => bookmark.url);
  //   if (inNewWindow) {
  //     // Open in new window
  //     return new Promise<void>((resolve, reject) => {
  //       chrome.windows.create({ url: urls[0] }, (window) => {
  //         if (chrome.runtime.lastError) {
  //           reject(chrome.runtime.lastError);
  //           return;
  //         }
  //         // Add remaining URLs as tabs
  //         const remainingUrls = urls.slice(1);
  //         if (remainingUrls.length > 0 && window?.id) {
  //           let tabsCreated = 0;
  //           remainingUrls.forEach((url, index) => {
  //             setTimeout(() => {
  //               chrome.tabs.create({ url, windowId: window.id }, () => {
  //                 tabsCreated++;
  //                 if (tabsCreated === remainingUrls.length) {
  //                   resolve();
  //                 }
  //               });
  //             }, index * 100);
  //           });
  //         } else {
  //           resolve();
  //         }
  //       });
  //     });
  //   } else {
  //     // Open in current window
  //     return new Promise<void>((resolve) => {
  //       let tabsCreated = 0;
  //       urls.forEach((url, index) => {
  //         setTimeout(() => {
  //           chrome.tabs.create({ url }, () => {
  //             tabsCreated++;
  //             if (tabsCreated === urls.length) {
  //               resolve();
  //             }
  //           });
  //         }, index * 100);
  //       });
  //     });
  //   }
  // }
}

export const defaultOpensService = new DefaultOpensService();
export default defaultOpensService;
