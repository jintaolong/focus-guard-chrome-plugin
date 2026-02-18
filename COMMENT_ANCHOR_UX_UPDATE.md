# Comment Anchor Link UX Enhancement

## Summary
Improved the user experience for comment anchor links (YouTube comment links) with enhanced toast notifications and better fallback handling when comments aren't loaded on the page.

## Changes Made

### 1. Enhanced Anchor Link Tooltip (CommentDisplay.tsx, Line ~406-416)
- **Old**: "Jump to this comment on YouTube"
- **New**: "Jump to this comment on YouTube. If not found, you can scroll to Comments or open the full video page."
- Explains that comments are loaded dynamically and provides context for fallback options

### 2. Multi-Button Toast Notifications (CommentDisplay.tsx, Line ~195-257)
Previously, the toast only showed a single "Jump" button. Now provides context-aware action buttons:

#### Toast Structure
- **Main message**: Clear, action-oriented text
- **Helper text** (smaller, lower opacity): "Comments are loaded as needed. Try scrolling down on YouTube to load more."
- **Action buttons**: Multiple contextual buttons depending on the scenario

#### Toast Scenarios

**Scenario 1: Comment Not Found Initially**
```
"Comment not found. Would you like to help me find it?"
Buttons:
- "Jump to Comments" → Scrolls to comments section and watches for the comment to load (15s timeout)
- "Open in New Tab" → Opens the direct YouTube comment link in a new tab
```

**Scenario 2: Comments Section Not Available**
```
"Comments section not available on this page."
Buttons:
- "Open Video" → Opens the full comment link which will navigate to the video
```

**Scenario 3: Comment Still Not Found After Waiting**
```
"Comment not found on this page."
Buttons:
- "Open in New Tab" → Opens the direct YouTube comment link in a new tab
- "Jump to Comments" → Re-attempts to scroll and watch for the comment (another 15s)
```

### 3. Visual Improvements
- **Larger padding**: Better spacing between message and buttons (12px 16px vs 8px 12px)
- **Darker background**: Increased opacity from 0.8 to 0.9 for better readability
- **Button styling**:
  - Semi-transparent white buttons with border
  - Smooth hover effects with background and border color transitions
  - Proper spacing between buttons (6px gap)
  - Icon-free, text-only design for clarity
- **Tooltip duration**: Increased from 3.5s to 5s to give users time to choose an action

### 4. Improved Comment Finding Logic
The existing 5-strategy fallback for finding comments remains intact:
1. Find by `youtube_comment_id` in DOM attributes
2. Check internal YouTube data structures
3. Search by comment ID in element attributes
4. Look for permalink anchors containing the comment ID
5. Match by comment text content and/or author name (fuzzy matching)

If initial strategies fail, the toast offers:
- **Jump to Comments**: Starts a 15-second polling loop with MutationObserver to detect when the comment loads
- **Open in New Tab**: Direct permalink to the comment on YouTube's full page

## User Experience Benefits

1. **Better Explanation**: Users understand why comments might not be found (dynamic loading)
2. **Multiple Paths Forward**: 
   - Automatic detection if comment loads while waiting
   - Manual scroll option to load more comments
   - Direct link option for guaranteed access
3. **Non-Intrusive**: Toast still auto-dismisses after 5s but provides actionable buttons for immediate interaction
4. **Visual Polish**: Better styling makes it feel intentional and polished

## Technical Details

### New Toast Signature
```typescript
showToast(
  msg: string, 
  actions?: Array<{ label: string; callback: () => void }>
): void
```

### Helper Text Logic
The helper text dynamically explains the comment loading behavior:
> "Comments are loaded as needed. Try scrolling down on YouTube to load more."

This educates users about YouTube's lazy-loading behavior without requiring documentation.

## Testing Checklist

- [ ] Click comment anchor when comment is already loaded → Scroll and highlight
- [ ] Click comment anchor when comment is NOT loaded → Show "Would you like to help me find it?" toast
- [ ] Click "Jump to Comments" on unloaded comment → Scroll to comments section and start polling
- [ ] Scroll down while polling → Comment loads and gets highlighted (if in view)
- [ ] Click "Open in New Tab" → New tab opens with direct comment link
- [ ] Let toast auto-dismiss after 5s → Works correctly
- [ ] Hover over buttons → Smooth background/border color transitions
- [ ] Multiple toast scenarios → All display correct buttons and messages

## Files Modified

- `components/CommentDisplay.tsx`:
  - Enhanced anchor link tooltip (line ~406-416)
  - Replaced `showToast()` implementation (line ~195-257)
  - Updated toast callback invocations (line ~276, ~338, ~345)
