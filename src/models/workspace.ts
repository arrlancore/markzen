export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  columnIds: string[];
  defaultOpenIds?: string[];
  color?: string;
  icon?: string;
}

export interface WorkspaceSettings {
  defaultWorkspaceId: string;
  lastVisitedWorkspaceId: string;
}

export interface Column {
  id: string;
  title: string;
  emoji: string;
  description: string;
  bookmarks: string[];
}

export const DEFAULT_COLUMNS: Column[] = [
  {
    id: "favorites",
    title: "Favorites",
    emoji: "⭐",
    description: "Most important and frequently used links",
    bookmarks: [],
  },
  {
    id: "projects",
    title: "Projects",
    emoji: "🎯",
    description: "Active project resources and links",
    bookmarks: [],
  },
  {
    id: "learning",
    title: "Learning",
    emoji: "🎓",
    description: "Learning materials and documentation",
    bookmarks: [],
  },
  {
    id: "tools",
    title: "Tools",
    emoji: "🛠️",
    description: "Useful tools and utilities",
    bookmarks: [],
  },
];
