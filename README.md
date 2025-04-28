# MarkZen - Kanban-style Bookmark Manager

MarkZen is a Chrome extension that transforms browser bookmarks from a cluttered list into a visually organized workspace, bringing clarity and calm to your digital life while respecting your privacy. You have the flexibility to choose between local storage or Chrome sync to store your bookmarks and settings.

## Overview

MarkZen offers a fresh approach to bookmark management with its Kanban-style interface. Organize your bookmarks into customizable columns, create separate workspaces for different contexts, and enjoy a beautiful new tab experience with quick access to your most frequently used bookmarks.

The extension features multiple ways to search your bookmarks:

1. **Integrated Search**: Access the search directly from the new tab page, with a clean search icon that opens a beautiful semi-transparent modal where you can search across all workspaces with results prioritizing title matches over URL matches.

2. **Omnibox Search**: Type `mz` in the address bar, press Tab, and start typing to instantly search all your bookmarks with smart matching. This fuzzy search intelligently matches partial words, acronyms, and even skipped words, making it easy to find bookmarks with queries like "aws dash" to find "AWS dashboard admin".

3. **Global Search**: Access your bookmarks using the keyboard shortcut Command + Shift + K (⌘+⇧+K). This allows users to quickly find and access their bookmarks without needing to navigate to the new tab page first.

## Key Features

- **Kanban-style Bookmark Management**: Visual drag-and-drop organization across customizable columns that you can create, edit, and delete as needed
- **Workspace Management**: Create multiple workspaces (work, personal, projects) for context separation with their own unique column arrangements
- **Enhanced New Tab Experience**: Beautiful background images, clock display, and quick access to your most frequently used bookmarks
- **Default Opens Feature**: Set bookmarks as "default opens" and launch them all with a single click, either in the current window or a new window
- **Smart Omnibox Integration**: Type `mz` + Tab in the address bar to search bookmarks with fuzzy matching from anywhere
- **Global Keyboard Shortcut**: Access your bookmarks from anywhere with Command + Shift + K (⌘+⇧+K)
- **Intelligent Search**: Find bookmarks easily with partial words, acronyms, and skipped words across all workspaces
- **Quick Note Feature**: Built-in notepad with Markdown support for jotting down thoughts directly in your browser
- **Bookmark Expiration**: Automatically flags bookmarks after a configurable period (30, 60, 90, or 180 days) to help you maintain a clean collection
- **Usage Analytics**: Automatically tracks which bookmarks you use most frequently to surface your most valuable resources
- **Metadata Extraction**: Automatically extracts meta descriptions and keywords when adding bookmarks from the popup
- **Flexible Storage Options**: Choose between local storage or Chrome sync to keep your bookmarks available across devices
- **Privacy-Focused Design**: All data stored locally with no external servers or accounts required
- **Customizable Themes**: Choose between light, dark, or system-based themes to match your preferences

## Component Highlights

### Quick Note Feature

MarkZen includes a built-in note-taking feature that allows you to:

- Jot down quick thoughts, ideas, or information while browsing
- Format your notes using Markdown with support for headings, lists, code blocks, and more
- Preview your formatted notes with a single click
- Auto-save functionality ensures you never lose your work
- Access your notes from any tab via the note icon in the interface
- Toggle between light and dark themes to reduce eye strain

The note feature is perfect for temporarily storing information before organizing it into your bookmark system, or for maintaining persistent notes that you can access from any tab.

### Default Opens System

The "Default Opens" feature streamlines your workflow by allowing you to:

- Mark important bookmarks as default opens for any workspace
- Open all default bookmarks with a single click
- Choose between opening in the current window or a new window
- Easily manage which bookmarks are included in your default opens set
- Drag and drop to add or rearrange default bookmarks

This feature is especially useful for daily workflows where you frequently open the same set of sites together.

### Advanced Search Capabilities

MarkZen provides a comprehensive search system designed to help you find your bookmarks quickly:

- **Integrated UI Search**: Access the search directly from the new tab page with a clean and intuitive interface
- **Omnibox Integration**: Search directly from Chrome's address bar by typing "mz" + Tab
- **Global Keyboard Shortcut**: Press Command + Shift + K (⌘+⇧+K) from anywhere to open the search interface
- **Fuzzy Search Algorithm**: Smart matching that understands partial words and typos
- **Acronym Detection**: Find bookmarks using acronyms of their titles (e.g., "AWS" for "Amazon Web Services")
- **Sequential Word Matching**: Search for multiple keywords in any order (e.g., "cloud app" would match "My Cloud App")
- **Skipped Word Support**: Find matches even when skipping words in longer titles
- **Cross-Workspace Search**: Search across all of your workspaces simultaneously
- **Prioritized Results**: Title matches are prioritized over URL matches for more relevant results
- **Highlighted Search Terms**: Clear highlighting of matching terms in search results

The search features are optimized for both speed and relevance, making it easy to find bookmarks even as your collection grows.

## Project Structure

The project is organized into several modules:

```
markzen/
├── manifest.json             # Extension manifest file (V3)
├── assets/                   # Static assets
│   ├── images/               # Extension icons and images
│   └── fonts/                # Custom fonts (if needed)
├── src/                      # JavaScript source code
│   ├── background/           # Service worker scripts
│   │   └── index.ts          # Main background service worker
│   ├── popup/                # Popup UI scripts
│   │   ├── popup.ts          # Popup functionality
│   │   ├── popup.html        # Popup HTML
│   │   └── popup.css         # Popup styles
│   ├── newtab/               # New tab page
│   │   ├── newtab.ts         # New tab functionality
│   │   ├── newtab.html       # New tab HTML
│   │   └── newtab.css        # New tab styles
│   ├── kanban/               # Kanban board implementation
│   │   ├── kanban.ts         # Main kanban module
│   │   ├── component-factory.ts # UI component creators
│   │   ├── data.ts           # Data handling
│   │   ├── drag-drop.ts      # Drag and drop functionality
│   │   ├── elements.ts       # DOM elements
│   │   ├── modals.ts         # Modal handling
│   │   ├── types.ts          # TypeScript types
│   │   ├── ui-utils.ts       # UI utilities
│   │   ├── kanban.html       # Kanban HTML
│   │   └── kanban.css        # Kanban styles
│   ├── settings/             # Settings page
│   │   ├── settings.ts       # Settings functionality
│   │   ├── settings.html     # Settings HTML
│   │   └── settings.css      # Settings styles
│   ├── note/                 # Quick note page
│   │   ├── note.ts           # Note functionality
│   │   ├── note.html         # Note HTML
│   │   └── note.css          # Note styles
│   ├── services/              # Service components
│   │   ├── RootService.ts    # Root service handling initialization
│   │   └── OmniboxService.ts # Omnibox search service
│   ├── utils/                # Utility functions
│   │   ├── storage.ts        # Storage management
│   │   ├── analytics.ts      # Usage analytics
│   │   ├── theme-service.ts  # Theme service
│   │   ├── note-service.ts   # Note service
│   │   ├── fuzzy-search.ts   # Smart fuzzy search algorithms
│   │   └── markdown-parser.ts # Markdown parser
│   └── models/               # Data models
│       ├── bookmark.ts       # Bookmark model
│       └── workspace.ts      # Workspace model
└── README.md                 # Project documentation
```

## Development

### Prerequisites

- Node.js (>= 16.x)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension:
   ```
   npm run build
   ```
4. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

### Development workflow

1. Start the development server:
   ```
   npm start
   ```
2. Make changes to the code
3. The extension will be automatically rebuilt

## Data Storage

MarkZen uses Chrome's storage API to store all data locally:

- `chrome.storage.local`: Used for all bookmark data, settings, and preferences
- No external servers or accounts required

## Data Privacy and Sync Options

MarkZen is designed with privacy in mind:

- All bookmark data is stored locally on your device using Chrome's storage API
- No external servers or accounts required
- No tracking or data collection beyond your local device

Sync Storage Options:
- If you're not signed into Chrome: The sync storage works like local storage, keeping data only on your current device
- If you're signed into Chrome: Your bookmarks will automatically sync across all devices where you're signed in with the same account

## License

MIT
