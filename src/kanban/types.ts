// Type definitions for the Kanban module
import { Bookmark, Column } from "../models/bookmark";
import { Workspace } from "../models/workspace";

// Define notification types
export type NotificationType = "success" | "error" | "warning";

// Define delete types
export type DeleteType = "bookmark" | "column" | "workspace" | null;

// Define state for the Kanban module
export interface KanbanState {
  activeWorkspaceId: string;
  workspaces: Record<string, Workspace>;
  columns: Record<string, Column>;
  bookmarks: Record<string, Bookmark>;
}

// Define editing state
export interface EditingState {
  currentWorkspaceId: string | null;
  currentColumnId: string | null;
  currentBookmarkId: string | null;
  currentColumnForBookmark: string | null;
  deleteType: DeleteType;
}
