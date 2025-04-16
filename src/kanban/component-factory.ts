// Factory functions for creating UI components
import { Bookmark, Column } from "../models/bookmark";
import { openBookmark } from "./data";
import { KanbanState } from "./types";
import * as modals from "./modals"; // Import modals directly to avoid circular dependency issues

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
      .filter((bookmark) => bookmark !== undefined)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    // Create bookmark elements
    columnBookmarks.forEach((bookmark) => {
      const bookmarkElement = createBookmarkElement(bookmark, {
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
      });
      body.appendChild(bookmarkElement);
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

/**
 * Create a bookmark element
 * @param bookmark The bookmark data
 * @param callbacks Object containing event callbacks
 */
export function createBookmarkElement(
  bookmark: Bookmark,
  callbacks: {
    editBookmark: (id: string) => void;
    deleteBookmark: (id: string) => void;
  }
): HTMLElement {
  const bookmarkElement = document.createElement("div");
  bookmarkElement.className = "bookmark-card";
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

  const deleteMenuItem = document.createElement("div");
  deleteMenuItem.className = "bookmark-menu-item danger";
  deleteMenuItem.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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

  menu.appendChild(menuBtn);
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

  return bookmarkElement;
}
