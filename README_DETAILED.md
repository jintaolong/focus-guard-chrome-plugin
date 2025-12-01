# Focus Guard Chrome Extension - Detailed Documentation

A Chrome extension that analyzes YouTube videos for trustworthiness, clickbait detection, and viewer sentiment insights. Built with [Plasmo](https://docs.plasmo.com/), React 18, and TypeScript.

## 🎯 Features (Functional Requirements)

### FR-100: General Requirements
- **Chrome MV3** extension for YouTube video analysis
- **React 18 + TypeScript** modern UI components
- **Plasmo Framework** for extension development

### FR-101: Pre-Watch Popover ⏳
*Not yet implemented*

### FR-102: Side-Panel Analysis
✅ **4-Tab Collapsible Side Panel** on YouTube watch pages:
1. **Summary Tab** - Trust score (0-100), clickbait verdict, channel credibility
2. **Viewer Insights Tab** - Sentiment donut chart, actionable insights from comments
3. **Content Gaps Tab** - Gap coverage score, unanswered questions, bot detection toggle
4. **Report Tab** - PDF/JSON download, analysis history

### FR-103: Status Chip
✅ **Inline Status Display** near video title showing:
- Trust score with color-coded background (green/yellow/red)
- Clickbait verdict badge
- "View Full Report" button

### FR-200: UI Patterns
✅ **Color Coding System** (FR-204):
- Green (#22c55e) - High trust, positive sentiment
- Yellow (#f59e0b) - Moderate trust, neutral sentiment
- Red (#ef4444) - Low trust, negative sentiment

### FR-300: Interactions
✅ **Auto-activate analysis** on watch page load (FR-202)
✅ **Collapsible side panel** with smooth animations

### FR-400: Data Display
✅ **StatementBlock pattern** (FR-401) - Statement + supporting comments with vote counts

## 🏗️ Project Structure

```
focus-guard-chrome-plugin/
├── background.ts              # Service worker (MV3)
├── content.tsx               # Main content script for YouTube
├── popup.tsx                 # Extension popup UI
├── components/
│   ├── StatusChip.tsx        # FR-103: Inline status chip
│   ├── StatementBlock.tsx    # FR-401: Reusable pattern
│   ├── SidePanel.tsx         # FR-102: Main side panel
│   ├── sidepanel/
│   │   ├── SummaryTab.tsx           # FR-102 Tab 1
│   │   ├── ViewerInsightsTab.tsx    # FR-102 Tab 2
│   │   ├── ContentGapsTab.tsx       # FR-102 Tab 3
│   │   └── ReportTab.tsx            # FR-102 Tab 4
│   ├── ResultsList.tsx       # Search results display
│   ├── SearchInterface.tsx   # Search UI
│   └── popup/                # Popup components
├── lib/
│   ├── api.ts                # API service layer
│   ├── colors.ts             # FR-204: Color utilities
│   └── mockData.ts           # Development test data
├── types/
│   ├── analysis.ts           # Video analysis types
│   ├── index.ts              # Core types
│   └── popup.ts              # Popup types
└── assets/                   # Images and icons
```

## 🚀 Development

### Prerequisites
- Node.js 18+
- Yarn (recommended) or npm

### Installation

```bash
# Install dependencies (use yarn - npm has issues with @parcel/watcher in WSL)
yarn install

# Start development server
yarn dev
# or
npm run dev
```

### Loading in Chrome

1. Build the extension:
   ```bash
   yarn build
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked"

5. Select the `build/chrome-mv3-prod` directory

### Development Mode

For live reloading during development:
```bash
yarn dev
```
Then load `build/chrome-mv3-dev` in Chrome.

## 📦 Building for Production

```bash
yarn build
```

This creates a production bundle in `build/chrome-mv3-prod/` ready for Chrome Web Store submission.

## 🧪 Testing

The extension currently uses **mock data** for development testing. Real API integration is commented out in `content.tsx`.

Mock data scenarios:
- **High Trust (85%)** - Educational content with verified sources
- **Moderate Trust (55%)** - Opinion content with mixed credibility
- **Low Trust (25%)** - Potential misinformation with poor sources

To switch to production API:
1. Uncomment API calls in `content.tsx` (lines ~166-171)
2. Comment out mock data imports (lines ~175-182)

## 🎨 Color System (FR-204)

| Trust Level | Color | Hex Code | Usage |
|------------|-------|----------|-------|
| High (70-100) | Green | #22c55e | Reliable content |
| Moderate (40-69) | Yellow | #f59e0b | Mixed credibility |
| Low (0-39) | Red | #ef4444 | Questionable content |

## 📋 Implementation Status

### ✅ Completed (9/12)
1. ✅ Type definitions for all FR requirements
2. ✅ Color utility system (FR-204)
3. ✅ StatusChip component (FR-103)
4. ✅ StatementBlock reusable pattern (FR-401)
5. ✅ All 4 side-panel tabs (FR-102)
6. ✅ Main SidePanel with navigation
7. ✅ API service methods
8. ✅ Content script for watch page detection
9. ✅ Mock data for development

### ⏳ Pending (3/12)
10. ⏳ FR-101: Pre-Watch Popover component
11. ⏳ Update popup.tsx for new mode options
12. ⏳ Backend API integration

## 🔧 Troubleshooting

### Build Errors
If you encounter native module build errors with `@parcel/watcher`, use **yarn** instead of npm:
```bash
rm -rf node_modules package-lock.json
yarn install
```

### Extension Not Loading
1. Check Chrome extensions page for errors
2. Ensure you loaded the correct build directory
3. Try reloading the extension
4. Check browser console for errors

### TypeScript Errors in IDE
The TypeScript language server may show errors for `~types/` imports before building. These resolve during Plasmo build. Run `yarn build` to verify actual compilation errors.

## 📚 Documentation

- [Frontend Functional Requirements](./COMPONENTS.md) - Detailed FR specifications
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - Technical implementation details
- [Plasmo Documentation](https://docs.plasmo.com/) - Framework reference
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)

## 🤝 Contributing

1. Create feature branch from `main`
2. Implement changes with FR references in commits
3. Test in Chrome with `yarn dev`
4. Build production bundle: `yarn build`
5. Submit PR with FR checklist

## 🔐 API Integration

Current API endpoints in `lib/api.ts`:

```typescript
// Video Analysis
analyzeVideo(videoId: string): Promise<VideoAnalysis>
getAnalysisHistory(): Promise<AnalysisHistoryItem[]>
downloadReport(videoId: string, format: 'PDF' | 'JSON'): Promise<Blob>

// Search (existing)
search(query: string): Promise<VideoResult[]>
getUserStats(): Promise<UserStats>
```

## 📝 Next Steps

### Priority 1: FR-101 Pre-Watch Popover
- Create popover component that displays before video playback
- Show analysis preview with trust score
- Add "Watch Anyway" and "View Full Analysis" buttons
- Implement dismissal logic

### Priority 2: Popup UI Updates
- Add "Video Analysis Mode" to mode selector
- Update settings UI for analysis preferences
- Add analysis history view
- Integrate with Chrome storage API

### Priority 3: Backend Integration
- Replace mock data with real API calls
- Implement authentication flow
- Add error handling and retry logic
- Set up rate limiting UI

### Priority 4: Testing & Polish
- E2E testing on various YouTube page types
- Performance optimization for large comment sets
- Accessibility improvements (ARIA labels, keyboard nav)
- Animation polish and responsive design

---

**Built with** ❤️ **using [Plasmo](https://www.plasmo.com/)**
