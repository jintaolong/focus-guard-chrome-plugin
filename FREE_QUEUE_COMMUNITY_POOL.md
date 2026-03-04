# Free Queue (Community Pool) Integration Guide

## Overview

The Free Queue (Community Pool) allows users who have exhausted their credits to generate one report per day, subject to a global daily limit. This feature is designed to drive daily active usage and provide a fair, first-come-first-served experience for the community.

- **Endpoint:** `GET /api/v1/free-queue/status`
- **Daily Limit:** Configurable via `MAX_FREE_DAILY_JOBS` (default: 50)
- **Eligibility:**
  - User must have zero credits
  - User has not used the free queue today
  - Pool has remaining capacity
- **Reset:** Pool resets at midnight UTC

## API Response Shape

```json
{
  "total_capacity": 100,
  "used_today": 18,
  "remaining": 82,
  "user_has_used_today": false,
  "user_eligible": true,
  "eligibility_reason": "Eligible",
  "next_reset_time": "2026-03-03T00:00:00Z"
}
```

## Chrome Extension Integration

- **Eligibility Check:**
  - Before triggering analysis, call `/api/v1/free-queue/status`.
  - If `user_eligible` is `true`, allow the user to run analysis via the free queue.
  - If not eligible, display the `eligibility_reason` and prompt for upgrade or credit purchase.
- **Silent Usage:**
  - When eligible, submit the analysis job as normal; the backend will route it to the free queue.
  - No special handling is needed for job submission; eligibility is enforced server-side.
- **UI Suggestions:**
  - Show a progress bar: "Daily Free Community Pool: 82/100 spots remaining."
  - When pool is empty: "Daily pool empty. Verification resumes in 14 hours. [Upgrade to skip the line]"

## Web Portal Integration

- **Dashboard Visualization:**
  - Display the current free queue usage and remaining slots on the user's dashboard home.
  - Poll `/api/v1/free-queue/status` to update the progress bar and eligibility in real time.
- **Eligibility Messaging:**
  - Show whether the user has used their daily slot and when the next reset occurs.
  - If eligible, allow the user to trigger analysis via the free queue.
  - If not, display the reason and prompt for upgrade or credit purchase.

## Implementation Notes

- The backend enforces all eligibility rules and atomic slot consumption.
- The frontend should use the status endpoint for all UI logic and messaging.
- The free queue is processed by a low-priority Celery worker; jobs may take longer to complete than paid jobs.
- The daily limit can be adjusted via environment variable for marketing or cost control.

---

For further details, see the [API Endpoints I/O Reference](API_ENDPOINTS_IO_REFERENCE.md).
