import { AuthService } from "./auth"
import { SubscriptionService } from "./subscription"
import type { SearchRequest, SearchResponse, UserStats } from "~types"
import type {
  VideoAnalysisRequest,
  VideoAnalysisResponse,
  ReportDownloadRequest,
  AnalysisHistoryResponse,
  VideoAnalysis,
  InsightWithComments,
  Comment
} from "~types/analysis"
import type {
  SummaryRequestV2,
  SummaryResponseV2,
  SentimentAnalysisRequest,
  SentimentResponseV2,
  TopicClusterResponseV2,
  TopicGapResponseV2,
  ChannelCredibilityResponseV2,
  HumanLikenessResponseV2,
  RelevancyResponseV2,
  CacheStatusResponse,
  SummaryStatusResponse,
  ReportRequest,
  ReportMetadata,
  JobSubmitResponse,
  JobStatusResponse,
  JobResultResponse,
  SummaryJobRequest,
  RunningJobInfo,
  JobType,
  JobStatus
} from "~types/backend"

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "https://test.commentverdict.com/api/v1"

export class FocusGuardAPI {
  private static async fetchAPI<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    // Use background worker to make the request (bypasses CORS for content scripts)
    console.log("FocusGuardAPI: Sending API request via background worker:", endpoint)
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        endpoint,
        options: {
          method: options?.method || 'GET',
          headers: options?.headers || {},
          body: options?.body
        }
      })

      console.log("FocusGuardAPI: Background response:", response?.success ? 'success' : 'failed')

      if (!response?.success) {
        throw new Error(response?.error || 'API request failed')
      }

      return response.data as T
    } catch (error) {
      console.error("FocusGuardAPI: API request error:", error)
      throw error
    }
  }

  private static async fetchWithAuth<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    await AuthService.ensureValidToken()
    const accessToken = await AuthService.getAccessToken()

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers
    }

    return this.fetchAPI<T>(endpoint, {
      ...options,
      headers
    })
  }

  // ============================================================================
  // Video Analysis V2 APIs (Cached-first)
  // ============================================================================

  /**
   * Get cache status for a video
   */
  static async getCacheStatus(videoId: string): Promise<CacheStatusResponse> {
    return this.fetchWithAuth<CacheStatusResponse>(`/videos/cache-status/${videoId}`)
  }

  /**
   * Check if there's an existing running job that matches the given criteria
   * @param cacheStatus - Cache status response containing running jobs
   * @param jobType - Type of job to match (summary, report)
   * @param queryContext - Optional query context to match
   * @returns The matching running job or null if none found
   */
  static findMatchingRunningJob(
    cacheStatus: CacheStatusResponse,
    jobType: JobType,
    queryContext?: string | null
  ): RunningJobInfo | null {
    if (!cacheStatus.has_running_jobs || cacheStatus.running_jobs.length === 0) {
      return null
    }

    // Find a job that matches both job_type and query_context
    return cacheStatus.running_jobs.find(job => 
      job.job_type === jobType && 
      job.query_context === (queryContext || null)
    ) || null
  }

  /**
   * Check if we should submit a new job or wait for an existing one
   * @param videoId - Video ID to check
   * @param jobType - Type of job (summary, report)
   * @param queryContext - Optional query context
   * @returns Object indicating whether to wait and which job to monitor
   */
  static async checkForRunningJobs(
    videoId: string,
    jobType: JobType,
    queryContext?: string | null
  ): Promise<{ shouldWait: boolean; existingJobId: string | null; existingJob: RunningJobInfo | null }> {
    try {
      const cacheStatus = await this.getCacheStatus(videoId)
      const matchingJob = this.findMatchingRunningJob(cacheStatus, jobType, queryContext)

      if (matchingJob) {
        console.log(`Found existing ${jobType} job for video ${videoId}:`, matchingJob.job_id)
        return {
          shouldWait: true,
          existingJobId: matchingJob.job_id,
          existingJob: matchingJob
        }
      }

      return {
        shouldWait: false,
        existingJobId: null,
        existingJob: null
      }
    } catch (error) {
      console.error("Error checking for running jobs:", error)
      // On error, proceed with submitting new job
      return {
        shouldWait: false,
        existingJobId: null,
        existingJob: null
      }
    }
  }

  /**
   * Get summary status for a video
   */
  static async getSummaryStatus(videoId: string): Promise<SummaryStatusResponse> {
    return this.fetchWithAuth<SummaryStatusResponse>(`/videos/summary/v2/status/${videoId}`)
  }

  /**
   * Analyze video and get complete summary (V2 - cached-first)
   */
  static async analyzeSummaryV2(request: SummaryRequestV2): Promise<SummaryResponseV2> {
    return this.fetchWithAuth<SummaryResponseV2>("/videos/summary/v2", {
      method: "POST",
      body: JSON.stringify(request)
    })
  }

  /**
    * Get relevancy status for a video
    */
  static async getRelevancyV2(videoId: string): Promise<RelevancyResponseV2> {
    return this.fetchWithAuth<RelevancyResponseV2>(`/videos/relevancy/v2`, {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, force_refresh: false })
    })
  }

  /**
   * Get sentiment analysis (V2 - cached-first)
   */
  static async analyzeSentimentV2(request: SentimentAnalysisRequest): Promise<SentimentResponseV2> {
    return this.fetchWithAuth<SentimentResponseV2>("/videos/sentiment/v2", {
      method: "POST",
      body: JSON.stringify(request)
    })
  }

  /**
   * Get topic clustering analysis (V2 - cached-first)
   */
  static async analyzeTopicClusteringV2(videoId: string, forceRefresh = false): Promise<TopicClusterResponseV2> {
    return this.fetchWithAuth<TopicClusterResponseV2>("/videos/topic-clustering/v2", {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, force_refresh: forceRefresh })
    })
  }

  /**
   * Get topic gap analysis (V2 - cached-first)
   */
  static async analyzeTopicGapV2(videoId: string, forceRefresh = false): Promise<TopicGapResponseV2> {
    return this.fetchWithAuth<TopicGapResponseV2>("/videos/topic-gap/v2", {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, force_refresh: forceRefresh })
    })
  }

  /**
   * Get channel credibility analysis (V2 - cached-first)
   */
  static async analyzeChannelCredibilityV2(videoId: string, forceRefresh = false): Promise<ChannelCredibilityResponseV2> {
    return this.fetchWithAuth<ChannelCredibilityResponseV2>("/videos/channel-credibility/v2", {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, force_refresh: forceRefresh })
    })
  }

  /**
   * Get human likeness (bot detection) analysis (V2 - cached-first)
   */
  static async analyzeHumanLikenessV2(videoId: string, forceRefresh = false): Promise<HumanLikenessResponseV2> {
    return this.fetchWithAuth<HumanLikenessResponseV2>("/videos/human-likeness/v2", {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, force_refresh: forceRefresh })
    })
  }

  /**
   * Get relevancy analysis (V2 - cached-first)
   */
  static async analyzeRelevancyV2(videoId: string, forceRefresh = false): Promise<RelevancyResponseV2> {
    return this.fetchWithAuth<RelevancyResponseV2>("/videos/relevancy/v2", {
      method: "POST",
      body: JSON.stringify({ video_id: videoId, force_refresh: forceRefresh })
    })
  }

  /**
   * Generate report (synchronous - requires Pro for PDF)
   */
  static async generateReport(request: ReportRequest): Promise<Blob> {
    await AuthService.ensureValidToken()
    const accessToken = await AuthService.getAccessToken()

    // Use background worker to bypass CORS
    const response = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/videos/generate-report',
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Accept: request.format === 'pdf' ? 'application/pdf' : 'text/plain'
        },
        body: JSON.stringify(request)
      }
    })

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to generate report')
    }

    // Convert base64 back to blob if it's a blob response
    if (response.isBlob) {
      const binary = atob(response.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return new Blob([bytes], { type: response.contentType })
    }

    throw new Error('Invalid response format')
  }

  /**
   * Get report metadata
   */
  static async getReportMetadata(videoId: string): Promise<ReportMetadata> {
    return this.fetchWithAuth<ReportMetadata>(`/videos/report-metadata/${videoId}`)
  }

  // ============================================================================
  // Async Job APIs (for first-time heavy analysis)
  // ============================================================================

  /**
   * Submit summary job (async) - checks for existing running jobs first
   */
  static async submitSummaryJob(request: SummaryJobRequest): Promise<JobSubmitResponse> {
    // Check if there's already a running job for this video and query context
    const { shouldWait, existingJobId, existingJob } = await this.checkForRunningJobs(
      request.video_id,
      "summary",
      request.query_context
    )

    if (shouldWait && existingJobId && existingJob) {
      console.log(`Using existing summary job ${existingJobId} instead of creating new one`)
      // Return a response that looks like a job submission but references the existing job
      return {
        job_id: existingJobId,
        status: existingJob.status as JobStatus,
        status_url: `/jobs/${existingJobId}/status`,
        result_url: `/jobs/${existingJobId}/result`,
        message: `Job already running (${existingJob.progress_percent}% complete)`
      }
    }

    // No matching job found, submit new one
    return this.fetchWithAuth<JobSubmitResponse>("/jobs/summary", {
      method: "POST",
      body: JSON.stringify(request)
    })
  }

  /**
   * Submit report generation job (async) - checks for existing running jobs first
   */
  static async submitReportJob(request: ReportRequest): Promise<JobSubmitResponse> {
    // Check if there's already a running job for this video and query context
    const { shouldWait, existingJobId, existingJob } = await this.checkForRunningJobs(
      request.video_id,
      "report",
      request.query_context
    )

    if (shouldWait && existingJobId && existingJob) {
      console.log(`Using existing report job ${existingJobId} instead of creating new one`)
      // Return a response that looks like a job submission but references the existing job
      return {
        job_id: existingJobId,
        status: existingJob.status as JobStatus,
        status_url: `/jobs/${existingJobId}/status`,
        result_url: `/jobs/${existingJobId}/result`,
        message: `Job already running (${existingJob.progress_percent}% complete)`
      }
    }

    // No matching job found, submit new one
    return this.fetchWithAuth<JobSubmitResponse>("/jobs/report", {
      method: "POST",
      body: JSON.stringify(request)
    })
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return this.fetchWithAuth<JobStatusResponse>(`/jobs/${jobId}/status`)
  }

  /**
   * Get job result
   */
  static async getJobResult(jobId: string): Promise<JobResultResponse> {
    return this.fetchWithAuth<JobResultResponse>(`/jobs/${jobId}/result`)
  }

  /**
   * Cancel job
   */
  static async cancelJob(jobId: string): Promise<void> {
    await this.fetchWithAuth(`/jobs/${jobId}`, { method: "DELETE" })
  }

  /**
   * Poll job until complete (helper method)
   */
  static async pollJob(
    jobId: string,
    onProgress?: (status: JobStatusResponse) => void,
    pollInterval = 2000
  ): Promise<JobResultResponse> {
    while (true) {
      const status = await this.getJobStatus(jobId)
      
      if (onProgress) {
        onProgress(status)
      }

      if (status.is_terminal) {
        if (status.status === "completed") {
          return await this.getJobResult(jobId)
        } else if (status.status === "failed") {
          throw new Error(status.error_message || "Job failed")
        } else if (status.status === "cancelled") {
          throw new Error("Job was cancelled")
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  // ============================================================================
  // High-level Video Analysis API
  // ============================================================================

  /**
   * Analyze video - decides between cached (V2) or async job based on cache status
   */
  static async analyzeVideo(
    request: VideoAnalysisRequest
  ): Promise<VideoAnalysisResponse> {
    const { videoId, forceRefresh } = request

    try {
      // Check cache status first
      const cacheStatus = await this.getCacheStatus(videoId)


      if (cacheStatus.cached && !forceRefresh) {
        // Use V2 cached endpoints for fast response
        const summary = await this.analyzeSummaryV2({
          video_id: videoId,
          force_refresh: false
        })

        // Fetch additional components in parallel (including relevancy)
        const [sentiment, credibility, humanLikeness, topicClusters, topicGaps, relevancy] = await Promise.all([
          this.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
          this.analyzeChannelCredibilityV2(videoId, false),
          this.analyzeHumanLikenessV2(videoId, false),
          this.analyzeTopicClusteringV2(videoId, false),
          this.analyzeTopicGapV2(videoId, false),
          this.analyzeRelevancyV2(videoId, false)
        ])

        // Transform to VideoAnalysis format (prefer relevancy for trust/confidence)
        const analysis = this.transformToVideoAnalysis(
          videoId,
          summary,
          sentiment,
          credibility,
          humanLikeness,
          topicClusters,
          topicGaps,
          relevancy
        )

        await SubscriptionService.trackUsage()

        return {
          analysis,
          cached: true
        }
      } else {
        // First-time or force refresh - use async job
        const job = await this.submitSummaryJob({
          video_id: videoId,
          force_refresh: forceRefresh || false
        })

        // Poll for completion
        const result = await this.pollJob(job.job_id)

        // Transform result to VideoAnalysis format
        const analysis = this.transformJobResultToVideoAnalysis(videoId, result.result_data)

        await SubscriptionService.trackUsage()

        return {
          analysis,
          cached: false
        }
      }
    } catch (error) {
      console.error("Video analysis failed:", error)
      throw error
    }
  }

  /**
   * Get cached video analysis (doesn't trigger new analysis)
   */
  static async getVideoAnalysis(videoId: string): Promise<VideoAnalysisResponse> {
    const cacheStatus = await this.getCacheStatus(videoId)
    
    if (!cacheStatus.cached) {
      throw new Error("Video not analyzed yet")
    }

    // Fetch from cache
    const summary = await this.analyzeSummaryV2({
      video_id: videoId,
      force_refresh: false
    })

    const [sentiment, credibility, humanLikeness, topicClusters, topicGaps, relevancy] = await Promise.all([
      this.analyzeSentimentV2({ video_id: videoId, force_refresh: false }),
      this.analyzeChannelCredibilityV2(videoId, false),
      this.analyzeHumanLikenessV2(videoId, false),
      this.analyzeTopicClusteringV2(videoId, false),
      this.analyzeTopicGapV2(videoId, false),
      this.analyzeRelevancyV2(videoId, false)
    ])

    const analysis = this.transformToVideoAnalysis(
      videoId,
      summary,
      sentiment,
      credibility,
      humanLikeness,
      topicClusters,
      topicGaps,
      relevancy
    )

    return {
      analysis,
      cached: true
    }
  }

  /**
   * Re-analyze video (force refresh)
   */
  static async reAnalyzeVideo(videoId: string): Promise<VideoAnalysisResponse> {
    return this.analyzeVideo({ videoId, forceRefresh: true })
  }

  /**
   * Download report
   */
  static async downloadReport(request: ReportDownloadRequest): Promise<Blob> {
    return this.generateReport({
      video_id: request.videoId,
      format: request.format.toLowerCase() as "txt" | "pdf",
      force_refresh: false
    })
  }

  /**
   * Get analysis history (placeholder - needs backend implementation)
   */
  static async getAnalysisHistory(): Promise<AnalysisHistoryResponse> {
    // TODO: Implement when backend adds history endpoint
    return {
      history: [],
      totalCount: 0
    }
  }

  // ============================================================================
  // Legacy APIs (kept for backward compatibility)
  // ============================================================================

  static async getUserStats(): Promise<UserStats> {
    try {
      const usage = await SubscriptionService.getUsage()
      return {
        searchesUsedToday: usage.daily_searches_used,
        searchesRemaining: usage.searches_remaining,
        tier: usage.tier === "PRO" ? "premium" : "free",
        resetTime: new Date().toISOString()
      }
    } catch (error) {
      console.error("Failed to get user stats:", error)
      throw error
    }
  }

  static async checkSearchAvailability(): Promise<boolean> {
    return SubscriptionService.canSearch()
  }

  static async search(request: SearchRequest): Promise<SearchResponse> {
    // TODO: Implement search with backend when available
    throw new Error("Search API not yet implemented")
  }

  // ============================================================================
  // Helper: Transform backend responses to frontend VideoAnalysis format
  // ============================================================================

  private static transformToVideoAnalysis(
    videoId: string,
    summary: SummaryResponseV2,
    sentiment: SentimentResponseV2,
    credibility: ChannelCredibilityResponseV2,
    humanLikeness: HumanLikenessResponseV2,
    topicClusters: TopicClusterResponseV2,
    topicGaps: TopicGapResponseV2,
    relevancy?: RelevancyResponseV2
  ): VideoAnalysis {
    const normalizeConfidence = (v: number) => {
      if (!Number.isFinite(v)) return 0
      if (v > 1.5) return v / 100
      if (v < 0) return 0
      return v
    }
    // Transform sentiment data - extract counts from nested structure
    const positiveCount = typeof sentiment.data.positive === 'number' ? sentiment.data.positive : (sentiment.data.positive?.count ?? 0)
    const neutralCount = typeof sentiment.data.neutral === 'number' ? sentiment.data.neutral : (sentiment.data.neutral?.count ?? 0)
    const negativeCount = typeof sentiment.data.negative === 'number' ? sentiment.data.negative : (sentiment.data.negative?.count ?? 0)
    const mixedCount = typeof sentiment.data.mixed === 'number' ? sentiment.data.mixed : (sentiment.data.mixed?.count ?? 0)
    const totalComments = sentiment.data.total_comments ?? (positiveCount + neutralCount + negativeCount + mixedCount)
    
    const sentimentDistribution = {
      positive: totalComments > 0 ? (positiveCount / totalComments) * 100 : 0,
      neutral: totalComments > 0 ? (neutralCount / totalComments) * 100 : 0,
      negative: totalComments > 0 ? (negativeCount / totalComments) * 100 : 0,
      mixed: totalComments > 0 ? (mixedCount / totalComments) * 100 : 0,
      totalCommentsAnalyzed: totalComments
    }

    // Transform topic clusters to insights
    const benefitInsights: InsightWithComments[] = topicClusters.topic_clusters
      .filter(cluster => cluster.count > 0)
      .slice(0, 5)
      .map((cluster, idx) => ({
        id: `benefit-${idx}`,
        statement: cluster.statement,
        type: "benefit" as const,
        commentCount: cluster.count,
        supportingComments: cluster.supporting_quotes.map((quote, qIdx) => ({
          id: `comment-${idx}-${qIdx}`,
          text: quote,
          humanLikenessScore: 8, // Default, would need actual HLS data per comment
          timestamp: undefined,
          author: undefined
        })),
        isExpanded: false
      }))

    // Transform topic gaps to gap insights
    const gapInsights: InsightWithComments[] = topicGaps.topic_gaps
      .slice(0, 5)
      .map((gap, idx) => ({
        id: `gap-${idx}`,
        statement: gap.question_statement,
        type: "gap" as const,
        commentCount: gap.supporting_comments.length,
        supportingComments: gap.supporting_comments.map((comment, cIdx) => ({
          id: `gap-comment-${idx}-${cIdx}`,
          text: comment,
          humanLikenessScore: 8,
          timestamp: undefined,
          author: undefined
        })),
        isExpanded: false
      }))

    const botPercentage = humanLikeness.total_comments > 0
      ? (humanLikeness.bot_count / humanLikeness.total_comments) * 100
      : 0

    // Prefer relevancy confidence when available
    const relevancyConfidenceNorm = relevancy && relevancy.data && typeof relevancy.data.confidence_score === 'number'
      ? normalizeConfidence(relevancy.data.confidence_score)
      : 0

    const relevancyVerdictLabel = relevancy && relevancy.data && relevancy.data.verdict
      ? String(relevancy.data.verdict).toUpperCase()
      : undefined

    // Helper to convert summary.credibility_score (0-100) to 0-10
    const credibilityScoreToTen = (n: number) => {
      if (!Number.isFinite(n)) return 5
      return n > 10 ? Math.round((n / 10) * 10) / 10 : Math.round(n * 10) / 10
    }

    return {
      videoId,
      videoTitle: summary.video_title,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      executiveSummary: summary.summary_paragraph,
      
      summary: {
        trustScore: relevancyConfidenceNorm > 0 ? Math.round(relevancyConfidenceNorm * 10 * 10) / 10 : credibilityScoreToTen(summary.credibility_score),
        aiConfidence: Math.round(relevancyConfidenceNorm * 100),
        clickbaitVerdict: {
          label: (relevancyVerdictLabel || "UNKNOWN") as any,
          confidence: Math.round(relevancyConfidenceNorm * 100)
        },
        channelCredibility: {
          score: credibility.score,
          factors: Object.entries(credibility.normalized_factors).map(([name, value]) => ({
            name,
            value: value.toString(),
            weight: value
          }))
        }
      },

      trustScore: {
        score: relevancyConfidenceNorm > 0 ? Math.round(relevancyConfidenceNorm * 10 * 10) / 10 : credibilityScoreToTen(summary.credibility_score),
        level: ((): string => {
          const cs = typeof summary.credibility_score === 'number' ? summary.credibility_score : 50
          const normalized = cs > 10 ? cs : cs * 10
          return normalized >= 70 ? 'high' : normalized >= 40 ? 'moderate' : 'low'
        })(),
        factors: []
      },

      sentiment: {
        overall: positiveCount > negativeCount ? "positive" : 
                 negativeCount > positiveCount ? "negative" : "neutral",
        distribution: sentimentDistribution
      },

      viewerInsights: {
        sentimentBreakdown: {
          positive: positiveCount,
          negative: negativeCount,
          neutral: neutralCount,
          mixed: mixedCount,
          totalCommentsAnalyzed: totalComments
        },
        actionableInsights: {
          highValue: benefitInsights,
          improvements: []
        }
      },

      contentGaps: {
        gapCoverageScore: topicGaps.topic_gaps.length > 0 ? 60 : 90,
        botPercentage,
        unansweredQuestions: gapInsights,
        botDetectionEnabled: true
      },

      channelCredibility: {
        score: credibility.score,
        verifiedStatus: false,
        history: credibility.channel_name || "Unknown",
        bias: "Unknown",
        factors: Object.entries(credibility.normalized_factors).map(([name, value]) => ({
          name,
          value: value.toString(),
          weight: value
        }))
      },

      reportInfo: {
        availableFormats: ["PDF", "TXT"],
        analysisDate: new Date().toISOString()
      },

      analyzedAt: new Date().toISOString(),
      isStale: false
    }
  }

  private static transformJobResultToVideoAnalysis(videoId: string, resultData: any): VideoAnalysis {
    // Transform async job result to VideoAnalysis format
    // The job result should contain similar structure to the V2 endpoints
    const normalizeConfidence = (v: any) => {
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n)) return 0
      if (n > 1.5) return n / 100
      if (n < 0) return 0
      return n
    }

    // Try to obtain relevancy info from resultData if present
    const relevancy = resultData.relevancy || resultData.relevancy_data || resultData.relevancy_result || null
    const rawConfidence = relevancy && relevancy.data && typeof relevancy.data.confidence_score === 'number'
      ? relevancy.data.confidence_score
      : (typeof resultData.confidence_score === 'number' ? resultData.confidence_score : (typeof resultData.confidence === 'number' ? resultData.confidence : undefined))

    const confidenceNorm = rawConfidence !== undefined ? normalizeConfidence(rawConfidence) : 0
    const verdictLabel = relevancy && relevancy.data && relevancy.data.verdict
      ? String(relevancy.data.verdict).toUpperCase()
      : (resultData.clickbait_verdict || resultData.clickbaitVerdict || {}).label || undefined

    const trustScoreVal = confidenceNorm > 0 ? Math.round(confidenceNorm * 10 * 10) / 10 : (resultData.credibility_score ? (resultData.credibility_score > 10 ? Math.round((resultData.credibility_score / 10) * 10) / 10 : Math.round(resultData.credibility_score * 10) / 10) : 50)

    return {
      videoId,
      videoTitle: resultData.video_title || "Unknown",
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      executiveSummary: resultData.summary_paragraph || resultData.summary || "Analysis complete",

      summary: {
        trustScore: trustScoreVal,
        aiConfidence: Math.round(confidenceNorm * 100),
        clickbaitVerdict: {
          label: (verdictLabel || "UNKNOWN") as any,
          confidence: Math.round(confidenceNorm * 100)
        }
      },

      analyzedAt: new Date().toISOString(),
      isStale: false
    }
  }
}
