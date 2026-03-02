/**
 * Analysis State Manager
 * 
 * This module handles video analysis state management and updates.
 * It contains logic for merging new analysis data with existing state,
 * preventing unnecessary re-renders, and managing analysis lifecycle.
 * 
 * Refactoring Guidelines:
 * - Move state update logic from setVideoAnalysis callbacks here
 * - Move early-exit checks for preventing re-renders here
 * - Move analysis result merging logic here
 * - Add helper functions for state validation
 * - Export functions that can be called from content.tsx
 */

import type { VideoAnalysis } from "~types/analysis"
import type { TierRestriction } from "~types/tierRestriction"

/**
 * Checks if existing analysis data is sufficient to skip updates
 * @param existingAnalysis - Current analysis state
 * @param newData - New data to potentially merge
 * @returns Boolean indicating if update should be skipped
 */
export function shouldSkipSecondaryDataUpdate(
  existingAnalysis: VideoAnalysis | null,
  videoId: string
): {
  shouldSkip: boolean
  hasExistingSentiment: boolean
  hasExistingCredibility: boolean
  hasExistingTopicClusters: boolean
  hasExistingContentGaps: boolean
} {
  // TODO: Move early-exit check logic from content.tsx
  if (!existingAnalysis || existingAnalysis.videoId !== videoId) {
    return {
      shouldSkip: false,
      hasExistingSentiment: false,
      hasExistingCredibility: false,
      hasExistingTopicClusters: false,
      hasExistingContentGaps: false
    }
  }

  return {
    shouldSkip: false,
    hasExistingSentiment: false,
    hasExistingCredibility: false,
    hasExistingTopicClusters: false,
    hasExistingContentGaps: false
  }
}

/**
 * Merges secondary analysis data into existing state
 * @param existingAnalysis - Current analysis state
 * @param secondaryData - New secondary data to merge
 * @returns Updated analysis object
 */
export function mergeSecondaryData(
  existingAnalysis: VideoAnalysis,
  secondaryData: {
    sentimentData?: any
    credibilityData?: any
    topicClustersData?: any
    topicGapsData?: any
    humanLikenessData?: any
    sentimentTierRestriction?: TierRestriction | null
    topicClustersTierRestriction?: TierRestriction | null
    topicGapsTierRestriction?: TierRestriction | null
  }
): VideoAnalysis {
  // TODO: Move conditional merge logic from content.tsx setVideoAnalysis callback
  return existingAnalysis
}

/**
 * Creates initial video analysis state from cache or API response
 * @param videoId - YouTube video ID
 * @param coreData - Core analysis data (summary + relevancy)
 * @returns Initial VideoAnalysis object
 */
export function createInitialAnalysis(
  videoId: string,
  coreData: {
    summaryData?: any
    relevancyData?: any
    cachePercentage?: number
  }
): Partial<VideoAnalysis> {
  // TODO: Move initial state creation logic from content.tsx
  return {
    videoId
  }
}

/**
 * Updates analysis state from completed job result
 * @param videoId - YouTube video ID
 * @param resultData - Complete job result data
 * @param userTier - User's subscription tier
 * @param dashboardUrl - URL to upgrade dashboard
 * @returns Complete VideoAnalysis object
 */
export function createAnalysisFromJobResult(
  videoId: string,
  resultData: any,
  userTier: string,
  dashboardUrl: string
): Partial<VideoAnalysis> {
  // TODO: Move job result processing logic from content.tsx
  return {
    videoId
  }
}

/**
 * Validates that analysis data belongs to the current video
 * Prevents race conditions when user switches videos quickly
 * @param currentVideoId - Current video ID being viewed
 * @param analysisVideoId - Video ID from analysis result
 * @returns Boolean indicating if data is still valid
 */
export function isAnalysisStillValid(
  currentVideoId: string | null,
  analysisVideoId: string
): boolean {
  return currentVideoId === analysisVideoId
}

/**
 * Calculates cache percentage from individual cache statuses
 * @param cacheStatuses - Object containing cache hit status for each analysis type
 * @returns Cache percentage (0-100)
 */
export function calculateCachePercentage(cacheStatuses: Record<string, boolean>): number {
  // TODO: Move cache percentage calculation logic here
  const statuses = Object.values(cacheStatuses)
  const cached = statuses.filter(Boolean).length
  return statuses.length > 0 ? Math.round((cached / statuses.length) * 100) : 0
}
