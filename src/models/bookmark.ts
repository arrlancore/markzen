export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  lastVisited?: string;
  columnId: string;
  workspaceId: string;
}

export interface BookmarkStats {
  id: string;
  clicks: number;
  lastClicked: string;
}

export interface Column {
  id: string;
  title: string;
  bookmarkIds: string[];
  workspaceId: string;
  createdAt: string;
  order: number;
}
