# Running Jobs Integration

## Overview
Updated the Chrome extension to integrate with the new `/cache-status/{video_id}` endpoint that returns information about running jobs. This prevents duplicate job submissions when another user is already processing the same video.

## Changes Made

### 1. Type Definitions (`types/backend.ts`)

#### New Interface: `RunningJobInfo`
```typescript
export interface RunningJobInfo {
  job_id: string              // Celery task ID
  job_type: JobType           // Type of job (summary, report, etc.)
  status: "pending" | "running" // Current status
  query_context: string | null // Query context for matching identical jobs
  created_at: string          // ISO datetime - when the job was created
  progress_percent: number    // Current progress (0-100)
  progress_message: string | null // Progress description
}
```

#### Updated Interface: `CacheStatusResponse`
Added two new fields:
- `has_running_jobs: boolean` - Indicates if there are any pending/running jobs
- `running_jobs: RunningJobInfo[]` - Array of job details

### 2. API Methods (`lib/api.ts`)

#### New Helper Methods

**`findMatchingRunningJob()`**
- Searches for an existing running job that matches the video, job type, and query context
- Returns the matching `RunningJobInfo` or `null`

**`checkForRunningJobs()`**
- Checks if there's an existing running job before submitting a new one
- Returns an object with:
  - `shouldWait: boolean` - Whether to wait for the existing job
  - `existingJobId: string | null` - ID of the existing job
  - `existingJob: RunningJobInfo | null` - Full details of the existing job

#### Updated Job Submission Methods

**`submitSummaryJob()`**
- Now checks for existing running jobs before submitting
- If a matching job exists, returns a response referencing that job instead of creating a duplicate
- Logs when reusing an existing job

**`submitReportJob()`**
- Same behavior as `submitSummaryJob()`
- Prevents duplicate report generation jobs

## Key Features

### 1. Job Matching Logic
Jobs are matched based on:
- **Video ID** - Must match exactly
- **Job Type** - Must be the same type (summary or report)
- **Query Context** - Must match (both `null` or same string value)

### 2. Automatic Deduplication
When a matching running job is found:
- The extension reuses the existing job instead of creating a new one
- The job ID is returned so the frontend can poll for status
- Progress information is included in the response message

### 3. Error Handling
- If checking for running jobs fails, the extension proceeds with submitting a new job
- This ensures the user experience isn't blocked by temporary API issues

## Usage Example

```typescript
// Submitting a summary job
const job = await FocusGuardAPI.submitSummaryJob({
  video_id: "dQw4w9WgXcQ",
  query_context: "user search query",
  force_refresh: false
});

// If a matching job exists, job.message will indicate:
// "Job already running (45% complete)"
// And job.job_id will reference the existing job

// You can then poll this job:
const status = await FocusGuardAPI.getJobStatus(job.job_id);
```

## Benefits

1. **Prevents Duplicate Processing** - Multiple users requesting the same video won't trigger multiple backend jobs
2. **Resource Optimization** - Backend resources are used more efficiently
3. **Consistent Results** - Users get results from the same analysis job
4. **Better User Experience** - Users can see existing job progress instead of starting from scratch
5. **Cost Reduction** - Fewer duplicate API calls and processing jobs

## Frontend Opportunities

The new data enables several UX improvements:

1. **Show Existing Job Progress**
   - Display "Another user is analyzing this video (45% complete)"
   - Show real-time progress bar based on `progress_percent`

2. **Estimated Time Remaining**
   - Calculate based on `created_at` and `progress_percent`

3. **Queue Position Awareness**
   - Show how many jobs are running for this video
   - Display job type (summary vs report)

4. **Smart Job Submission**
   - Only show "Analyze" button if no matching job exists
   - Change button to "View Progress" if job is running

## Testing Considerations

To test this functionality:
1. Have two users request analysis for the same video simultaneously
2. Verify only one backend job is created
3. Verify both users see the same job progress
4. Test with different query contexts (should create separate jobs)
5. Test error scenarios (API failures, network issues)

## Future Enhancements

Potential improvements for future iterations:
- Real-time job progress updates via WebSockets
- Job priority queue for premium users
- Job cancellation support
- Job result caching with expiration
- Multi-user collaboration indicators
