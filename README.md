# Focus Guard Chrome Extension

A Chrome extension built with **Plasmo**, **React**, and **Manifest V3**.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm package manager

### Installation

1. Install dependencies:
```bash
npm install
# or
pnpm install
```

### Development

Run the development server:
```bash
npm run dev
# or
pnpm dev
```

This will:
- Start the Plasmo dev server
- Generate the extension in the `build/chrome-mv3-dev` folder
- Enable hot module reloading

### Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `build/chrome-mv3-dev` folder

### Production Build

Build the extension for production:
```bash
npm run build
# or
pnpm build
```

The production-ready extension will be in `build/chrome-mv3-prod`.

### Package for Distribution

Create a zip file for Chrome Web Store submission:
```bash
npm run package
# or
pnpm package
```

## 📁 Project Structure

```
focus-guard-chrome-plugin/
├── popup.tsx          # Extension popup UI (React component)
├── content.tsx        # Content script injected into web pages
├── background.ts      # Service worker for MV3
├── style.css          # Popup styles
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

## 🛠️ Features

- **Popup UI**: Interactive popup with React components
- **Content Script**: Injects UI elements into web pages
- **Background Service Worker**: Handles background tasks (MV3 compatible)
- **Chrome Storage API**: Persist data across sessions
- **TypeScript**: Full type safety
- **Hot Reload**: Instant updates during development

## 📝 Customization

### Permissions

Edit `package.json` to add more permissions:
```json
"manifest": {
  "host_permissions": ["https://*/*"],
  "permissions": ["storage", "tabs", "activeTab"]
}
```

### Content Script Matching

Edit `content.tsx` to change which pages the content script runs on:
```typescript
export const config: PlasmoCSConfig = {
  matches: ["https://example.com/*"],
  all_frames: false
}
```

## 📚 Resources

- [Plasmo Documentation](https://docs.plasmo.com/)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)

## 📄 License

MIT
