# Usage Milestone Notifications

## Overview
The popup now displays smart usage milestone notifications to inform users about their daily usage and encourage appropriate actions.

## PRO Users

### 80% Milestone (80 videos analyzed)
**Visual**: Green success-style notification  
**Message**: "You've been busy today! You've analyzed 80 videos. Keep going!"  
**Purpose**: Positive reinforcement, no action required

### 100% Cap Reached (100 videos)
**Visual**: Red alert-style notification  
**Title**: "You're a Power User!"  
**Message**: "You've analyzed 100 videos in the last 24 hours. To protect our systems from automated activity, we've placed a temporary pause on your reports. Your quota will reset at midnight UTC."  
**CTA**: "Need more? Contact us <commentverdict@gmail.com> for Enterprise access." (button opens Manage Plan)  
**Purpose**: Explain rate limit, offer Enterprise option

## FREE & STARTER Users

### Daily Limit Reached
**Visual**: Red alert-style notification  
**Title**: "Daily Limit Reached"  
**Message**: "You've used all [X] of your daily searches. Your quota will reset at midnight UTC."  
**CTA**:
- FREE users: "Upgrade to STARTER or PRO for more searches"
- STARTER users: "Upgrade to PRO for unlimited access"

**Button**: Opens Manage Plan page for upgrades

## Technical Implementation

- Added `getUsageMilestone()` function in `AccountInfo.tsx`
- Checks tier and usage percentage to determine which notification to show
- Milestone notification appears above the usage stats section
- All CTAs connect to the existing "Manage Plan" handler
- Styling uses appropriate color schemes (green for encouragement, red for limits)

## Notification Priority

1. PRO cap (100 videos) - highest priority
2. PRO 80% milestone
3. FREE/STARTER limit reached

Only one notification is shown at a time (highest priority takes precedence).
