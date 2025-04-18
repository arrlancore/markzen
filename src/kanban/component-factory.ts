// Factory functions for creating UI components
import { Bookmark, Column } from "../models/bookmark";
import { openBookmark } from "./data";
import { KanbanState } from "./types";
import * as modals from "./modals"; // Import modals directly to avoid circular dependency issues
import storageService from "@/utils/storage";
import {
  checkBookmarkExpiration,
  formatTimeSinceLastVisit,
} from "@/utils/expiration-utils";
import { showNotification } from "./ui-utils";

// Import or declare settings at the top of the file
let appSettings: any = null;

/**
 * Create a column element
 * @param column The column data
 * @param state The current application state
 * @param callbacks Object containing event callbacks
 */
export function createColumnElement(
  column: Column,
  state: KanbanState,
  callbacks: {
    editColumn: (id: string) => void;
    addBookmark: (columnId: string) => void;
    archiveBookmark: (id: string, columnId: string) => void;
  }
): HTMLElement {
  // Create column container
  const columnElement = document.createElement("div");
  columnElement.className = "kanban-column";
  columnElement.dataset.id = column.id;

  // Create column header
  const header = document.createElement("div");
  header.className = "column-header";

  const titleContainer = document.createElement("div");
  titleContainer.className = "column-title-container";

  const title = document.createElement("span");
  title.className = "column-title";
  title.textContent = column.title;

  const count = document.createElement("span");
  count.className = "column-count";
  count.textContent = column.bookmarkIds.length.toString();

  titleContainer.appendChild(title);
  titleContainer.appendChild(count);

  const actions = document.createElement("div");
  actions.className = "column-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "column-action";
  editBtn.title = "Edit Column";
  editBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `;
  editBtn.addEventListener("click", () => callbacks.editColumn(column.id));

  actions.appendChild(editBtn);

  header.appendChild(titleContainer);
  header.appendChild(actions);

  // Create column body
  const body = document.createElement("div");
  body.className = "column-body";
  body.dataset.columnId = column.id;

  // Add bookmarks or empty state
  if (column.bookmarkIds.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "column-empty";
    emptyState.textContent = "No bookmarks yet";
    body.appendChild(emptyState);
  } else {
    // Get and sort bookmarks by creation date (newest first)
    const columnBookmarks = column.bookmarkIds
      .map((id) => state.bookmarks[id])
      .filter((bookmark) => bookmark !== undefined);
    // Create bookmark elements
    // Inside createColumnElement function, where bookmarks are created:
    // Get all default open IDs for the current workspace
    const workspace = state.workspaces[state.activeWorkspaceId];
    const defaultOpenIds = workspace?.defaultOpenIds || [];

    // Create bookmark elements
    columnBookmarks.forEach((bookmark) => {
      // Check if bookmark is in default opens
      const isDefaultOpen = defaultOpenIds.includes(bookmark.id);

      const bookmarkElement = createBookmarkElement(
        bookmark,
        {
          editBookmark: (id) => {
            modals.openEditBookmarkModal(id, state.bookmarks);
          },
          deleteBookmark: (id) => {
            // Set up the necessary state and show delete modal
            modals.confirmBookmarkDeletion(
              id,
              bookmark.columnId,
              state.bookmarks
            );
          },
          archiveBookmark: (id, columnId) => {
            // Call the archive function
            callbacks.archiveBookmark(id, columnId);
          },
        },
        isDefaultOpen
      ); // Pass the isDefaultOpen flag

      bookmarkElement
        .then((bookmarkElementResolved) => {
          // Append the bookmark element to the column body
          body.appendChild(bookmarkElementResolved);
        })
        .catch((error) => {
          console.error("Error creating bookmark element:", error);
        });
    });
  }

  // Create column footer
  const footer = document.createElement("div");
  footer.className = "column-footer";

  const addBtn = document.createElement("button");
  addBtn.className = "add-bookmark-btn";
  addBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
    <span>Add Bookmark</span>
  `;
  addBtn.addEventListener("click", () => callbacks.addBookmark(column.id));

  footer.appendChild(addBtn);

  // Assemble column
  columnElement.appendChild(header);
  columnElement.appendChild(body);
  columnElement.appendChild(footer);

  return columnElement;
}

// Update the createBookmarkElement function in src/kanban/component-factory.ts

/**
 * Create a bookmark element
 * @param bookmark The bookmark data
 * @param callbacks Object containing event callbacks
 * @param isDefaultOpen Whether the bookmark is a default open
 */
export async function createBookmarkElement(
  bookmark: Bookmark,
  callbacks: {
    editBookmark: (id: string) => void;
    deleteBookmark: (id: string) => void;
    archiveBookmark?: (id: string, columnId: string) => void;
  },
  isDefaultOpen: boolean = false // Add this parameter
): Promise<HTMLElement> {
  // Ensure settings are loaded
  if (!appSettings) {
    appSettings = await storageService.getSettings();
  }

  // Check if bookmark is expired
  const { isExpired, daysSinceLastVisit } = checkBookmarkExpiration(
    bookmark,
    appSettings
  );

  const bookmarkElement = document.createElement("div");
  bookmarkElement.className = "bookmark-card";
  if (isExpired) {
    bookmarkElement.classList.add("expired-bookmark");
  }
  bookmarkElement.dataset.id = bookmark.id;
  bookmarkElement.draggable = true;

  // Create bookmark header
  const header = document.createElement("div");
  header.className = "bookmark-header";

  const favicon = document.createElement("img");
  favicon.className = "bookmark-favicon";
  favicon.src = bookmark.favicon || "../assets/images/default-favicon.png";
  favicon.alt = "";

  const title = document.createElement("div");
  title.className = "bookmark-title";
  title.textContent = bookmark.title;

  const menu = document.createElement("div");
  menu.className = "bookmark-menu";

  const menuBtn = document.createElement("button");
  menuBtn.className = "bookmark-menu-btn";
  menuBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="12" cy="5" r="1"></circle>
      <circle cx="12" cy="19" r="1"></circle>
    </svg>
  `;

  const menuBtnContainer = document.createElement("div");
  menuBtnContainer.className = "menu-btn-container";

  // Add expiration warning icon if bookmark is expired
  if (isExpired && daysSinceLastVisit !== null) {
    const warningBtn = document.createElement("button");
    warningBtn.className = "bookmark-warning-btn";
    warningBtn.title = `Last visited: ${formatTimeSinceLastVisit(
      daysSinceLastVisit
    )}`;
    warningBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="6" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `;
    menuBtnContainer.appendChild(warningBtn);
  }

  menuBtnContainer.appendChild(menuBtn);
  menu.appendChild(menuBtnContainer);

  const menuDropdown = document.createElement("div");
  menuDropdown.className = "bookmark-menu-dropdown";

  const editMenuItem = document.createElement("div");
  editMenuItem.className = "bookmark-menu-item";
  editMenuItem.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    <span>Edit</span>
  `;
  editMenuItem.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.remove("active");
    callbacks.editBookmark(bookmark.id);
  });

  const openMenuItem = document.createElement("div");
  openMenuItem.className = "bookmark-menu-item";
  openMenuItem.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
    <span>Open</span>
  `;
  openMenuItem.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.remove("active");
    openBookmark(bookmark.id, bookmark.url);
  });

  // Add Archive option for expired bookmarks
  if (isExpired && appSettings.bookmarkExpirationDays !== "never") {
    const archiveMenuItem = document.createElement("div");
    archiveMenuItem.className = "bookmark-menu-item";
    archiveMenuItem.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="21 8 21 21 3 21 3 8"></polyline>
        <rect x="1" y="3" width="22" height="5"></rect>
        <line x1="10" y1="12" x2="14" y2="12"></line>
      </svg>
      <span>Archive</span>
    `;
    archiveMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menuDropdown.classList.remove("active");

      // Call archive function if available, otherwise show alert
      if (callbacks.archiveBookmark) {
        callbacks.archiveBookmark(bookmark.id, bookmark.columnId);
      } else {
        alert("Archive functionality not available");
      }
    });

    menuDropdown.appendChild(archiveMenuItem);
  }

  const deleteMenuItem = document.createElement("div");
  deleteMenuItem.className = "bookmark-menu-item danger";
  deleteMenuItem.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
    <span>Delete</span>
  `;
  deleteMenuItem.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.remove("active");
    callbacks.deleteBookmark(bookmark.id);
  });

  menuDropdown.appendChild(editMenuItem);
  menuDropdown.appendChild(openMenuItem);
  menuDropdown.appendChild(deleteMenuItem);

  menu.appendChild(menuDropdown);

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle("active");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    menuDropdown.classList.remove("active");
  });

  header.appendChild(favicon);
  header.appendChild(title);
  header.appendChild(menu);

  // Create bookmark URL
  const url = document.createElement("div");
  url.className = "bookmark-url";
  url.textContent = bookmark.url;

  // Create bookmark description if exists
  let description;
  if (bookmark.description) {
    description = document.createElement("div");
    description.className = "bookmark-description";
    description.textContent = bookmark.description;
  }

  // Create bookmark tags if exists
  let tags: HTMLDivElement | undefined;
  if (bookmark.tags && bookmark.tags.length > 0) {
    tags = document.createElement("div");
    tags.className = "bookmark-tags";

    bookmark.tags.forEach((tag) => {
      const tagElement = document.createElement("span");
      tagElement.className = "bookmark-tag";
      tagElement.textContent = tag;
      tags?.appendChild(tagElement);
    });
  }

  // Assemble bookmark card
  bookmarkElement.appendChild(header);
  bookmarkElement.appendChild(url);
  if (description) bookmarkElement.appendChild(description);
  if (tags) bookmarkElement.appendChild(tags);

  // Add click event to open bookmark
  bookmarkElement.addEventListener("click", () => {
    openBookmark(bookmark.id, bookmark.url);
  });

  // Add default open indicator if bookmark is a default open
  if (isDefaultOpen) {
    const defaultIndicator = document.createElement("div");
    defaultIndicator.className = "bookmark-default-indicator";
    defaultIndicator.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
    `;
    bookmarkElement.appendChild(defaultIndicator);
  }

  return bookmarkElement;
}

// Add this function to src/kanban/component-factory.ts

/**
 * Create a default open item element
 * @param bookmark The bookmark data
 * @param callbacks Object containing event callbacks
 */
export function createDefaultOpenElement(
  bookmark: Bookmark,
  callbacks: {
    removeDefaultOpen: (id: string) => void;
  }
): HTMLElement {
  // Create default open container
  const defaultOpenElement = document.createElement("div");
  defaultOpenElement.className = "default-open-item";
  defaultOpenElement.dataset.id = bookmark.id;
  defaultOpenElement.draggable = true;

  // Create favicon
  const favicon = document.createElement("img");
  favicon.className = "default-open-favicon";
  favicon.src = bookmark.favicon || "../assets/images/default-favicon.png";
  favicon.alt = "";

  // Create title
  const title = document.createElement("div");
  title.className = "default-open-title";
  title.textContent = bookmark.title;
  title.title = bookmark.title; // Add tooltip with full title

  // Create remove button
  const removeBtn = document.createElement("button");
  removeBtn.className = "default-open-remove";
  removeBtn.title = "Remove from default opens";
  removeBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;

  // Add remove event listener
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent opening the bookmark
    callbacks.removeDefaultOpen(bookmark.id);
  });

  // Assemble default open item
  defaultOpenElement.appendChild(favicon);
  defaultOpenElement.appendChild(title);
  defaultOpenElement.appendChild(removeBtn);

  // Add click event to open bookmark
  defaultOpenElement.addEventListener("click", () => {
    openBookmark(bookmark.id, bookmark.url);
  });

  return defaultOpenElement;
}
