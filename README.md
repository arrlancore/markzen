# MarkZen - Kanban-style Bookmark Manager

MarkZen is a Chrome extension that transforms browser bookmarks from a cluttered list into a visually organized workspace, bringing clarity and calm to your digital life while respecting your privacy. You have the flexibility to choose between local storage or Chrome sync to store your bookmarks and settings.

The search is integrated directly into the new tab page, appearing as a clean search icon in the top-right corner next to your existing Kanban board and settings icons. When clicked, it displays a beautiful semi-transparent modal with a search input field.
As the user types, the search automatically filters through all bookmarks across all workspaces, looking for matches in both titles and URLs. It prioritizes title matches over URL matches

Sync Storage Notes: 
- If the user isn't signed in: The sync storage works, but data remains only on that device - it's essentially the same as local storage in behavior.
- If the user signs in: Chrome will automatically sync that storage data across all their devices where they're signed in with the same account.

## Features

- **Kanban-style Bookmark Management**: Visual drag-and-drop organization across customizable columns
- **Workspace Management**: Create multiple workspaces (work, personal, projects) for context separation
- **Enhanced New Tab Experience**: Beautiful background images, clock, and most frequently used bookmarks
- **Privacy-Focused**: All data stored locally with no login required
- **Usage Analytics**: Track bookmark engagement to surface most valuable resources
- **Open Multiple Bookmarks**: One click to open all bookmarks that set as default on a workspace

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
│   ├── utils/                # Utility functions
│   │   ├── storage.ts        # Storage management
│   │   └── analytics.ts      # Usage analytics
│   │   └── theme-service.ts  # Service for managing theme
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

## License

## TODO
- [ ] auto populate meta description to description and keywords to tag if we add to bookmurk from popup
- [ ] simple auto complete search feature
- [x] impement default open features
- [ ] test from fresh data and perform all features
- [ ] a simple note, show note icon on new tab, when click it show a modal for user to start writing, it will stored on 
- [ ] publish it  

MIT