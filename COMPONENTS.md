# Focus Guard - Components Overview

## Main Components Created

### 1. **SearchInterface** (`components/SearchInterface.tsx`)
- Chat-first search UI with textarea input
- Displays user's tier and remaining searches
- Shows example queries
- Handles search limit warnings
- Disables when searches are exhausted

### 2. **VideoResultCard** (`components/VideoResultCard.tsx`)
- Individual video result card
- Shows thumbnail, title, channel, metadata
- Displays three key metrics:
  - **Relevance Score** (0-100%)
  - **Transcript Sentiment** (positive/neutral/negative)
  - **Comment Sentiment** (positive/neutral/negative)
- Clickable link to YouTube video

### 3. **ResultsList** (`components/ResultsList.tsx`)
- Container for all search results
- Shows loading state with spinner
- Displays up to 5 curated results
- Header with result count and description

### 4. **Content Script** (`content.tsx`)
- Detects YouTube home/feed pages
- Hides default YouTube feed
- Renders Focus Guard UI overlay
- Manages search state and user stats
- Communicates with backend API

## Type Definitions (`types/index.ts`)

```typescript
- VideoResult: Individual video data with metrics
- SearchRequest: Search query with optional filters
- SearchResponse: API response with results
- UserStats: User tier and search limits
```

## API Service (`lib/api.ts`)

- `FocusGuardAPI.search()`: Send search request
- `FocusGuardAPI.getUserStats()`: Get user stats
- `FocusGuardAPI.checkSearchAvailability()`: Check if searches available

## Environment Setup

Add to `.env.local`:
```
PLASMO_PUBLIC_API_URL=http://localhost:3000/api
```

## Usage Flow

1. User visits YouTube home → Feed is replaced with Focus Guard
2. User enters search query → API call with query
3. Backend returns 5 curated results with metrics
4. Results displayed with sentiment analysis
5. Click video → Opens on YouTube
6. Search count decrements (max 3/day for free tier)
