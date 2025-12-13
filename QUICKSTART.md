# Backend Integration Quick Start

## 🎉 Integration Complete!

The Focus Guard Chrome extension is now fully integrated with the CommentVerdict backend API at `https://test.commentverdict.com`.

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
The `.env` file is already configured to use the test backend:
```bash
PLASMO_PUBLIC_API_URL=https://test.commentverdict.com/api/v1
```

### 3. Build and Run
```bash
# Development build with hot reload
pnpm dev

# Production build
pnpm build
```

### 4. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` folder

### 5. Test the Integration

#### Authentication
1. Click the extension icon
2. Click "Sign up" to create a new account
3. Enter email, password (min 8 chars), and full name
4. Or click "Sign in" if you already have an account

#### Video Analysis
1. Navigate to any YouTube video (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
2. Click the "Analyze Video" button (🛡️ icon near the video player)
3. Wait for analysis to complete
4. View results in the side panel

#### Usage Tracking
1. Open the extension popup
2. See your current tier and remaining daily searches
3. Usage decrements automatically after each analysis

#### Upgrade (Test Mode)
1. In the popup, click "Upgrade to Pro"
2. This will open Stripe Checkout (test environment)
3. Use test card: `4242 4242 4242 4242`

## Key Features Implemented

### ✅ Authentication
- User registration with email/password
- OAuth2 login flow with JWT tokens
- Automatic token refresh
- Secure token storage in Chrome storage

### ✅ Video Analysis
- Cache-first strategy (fast for analyzed videos)
- Async job processing for new videos
- Complete analysis: sentiment, topics, gaps, credibility
- Bot detection (Human Likeness Score)
- Report generation (TXT/PDF)

### ✅ Subscription Management
- Tier display (Free/Starter/Pro)
- Usage tracking and limits
- Stripe Checkout integration
- Upgrade/downgrade functionality

### ✅ Error Handling
- Automatic retry with exponential backoff
- Token refresh on authentication errors
- User-friendly error messages
- Graceful fallback to mock data in development

## Architecture

### Services
- **`lib/auth.ts`**: Authentication service (login, register, token management)
- **`lib/subscription.ts`**: Subscription and usage tracking
- **`lib/api.ts`**: Video analysis API client
- **`lib/apiUtils.ts`**: Error handling and retry logic

### Types
- **`types/backend.ts`**: Complete backend API type definitions
- **`types/analysis.ts`**: Frontend analysis types
- **`types/popup.ts`**: Popup UI types

### Components
- **`popup.tsx`**: Main popup with authentication
- **`components/popup/LoginForm.tsx`**: Login/register form
- **`content.tsx`**: Video analysis UI injection

## API Flow

### First-Time Video Analysis
```
User clicks "Analyze" 
  → Check cache status
  → Submit async job (POST /jobs/summary)
  → Poll for completion (GET /jobs/{id}/status)
  → Get result (GET /jobs/{id}/result)
  → Display analysis
  → Track usage
```

### Cached Video Analysis
```
User clicks "Analyze"
  → Check cache status
  → Fetch summary (POST /videos/summary/v2)
  → Fetch components in parallel:
     - Sentiment (POST /videos/sentiment/v2)
     - Credibility (POST /videos/channel-credibility/v2)
     - Topics (POST /videos/topic-clustering/v2)
     - Gaps (POST /videos/topic-gap/v2)
     - Bot detection (POST /videos/human-likeness/v2)
  → Display analysis
  → Track usage
```

## Debugging

### Enable Debug Mode
```bash
# In .env
FOCUS_GUARD_DEBUG=1
```

This enables the video analysis UI on all YouTube pages (not just watch pages) for easier testing.

### Console Logs
Open Chrome DevTools console to see:
- Authentication status
- API requests/responses
- Token refresh operations
- Analysis progress
- Error details

### Common Issues

**Q: "Authentication required" error**  
A: Open the popup and log in. Tokens expire after a period.

**Q: "Rate limit exceeded"**  
A: You've hit the daily usage limit. Wait for reset or upgrade.

**Q: Analysis stuck on "Analyzing..."**  
A: Check console for errors. First-time analysis can take 30-60 seconds.

**Q: PDF report fails**  
A: PDF generation requires Pro tier. Try TXT format instead.

## Testing Credentials

For testing, you can create a new account or use test credentials if provided by the backend team.

**Test Stripe Card**: `4242 4242 4242 4242` (any future expiry, any CVC)

## Next Steps

1. **Email Verification**: Add UI flow for email verification (required for paid tiers)
2. **Analysis History**: Implement history display when backend endpoint is ready
3. **Real-time Updates**: Add webhook listener for subscription changes
4. **Offline Support**: Cache analysis results for offline viewing

## Documentation

- **`BACKEND_INTEGRATION.md`**: Detailed integration documentation
- **Backend API Docs**: `https://test.commentverdict.com/api/v1/docs`
- **OpenAPI Spec**: `https://test.commentverdict.com/api/v1/openapi.json`

## Support

For issues:
1. Check browser console for errors
2. Verify backend API is accessible
3. Review `.env` configuration
4. Check backend documentation

---

**Happy integrating! 🚀**
