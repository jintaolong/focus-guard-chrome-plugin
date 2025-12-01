import type { SearchRequest, SearchResponse, UserStats } from "~types"
import type {
  VideoAnalysisRequest,
  VideoAnalysisResponse,
  ReportDownloadRequest,
  AnalysisHistoryResponse
} from "~types/analysis"

const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:3000/api"

export class FocusGuardAPI {
  private static async fetchAPI<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }

    return response.json()
  }

  // Original search API (for home/feed replacement)
  static async search(request: SearchRequest): Promise<SearchResponse> {
    return this.fetchAPI<SearchResponse>("/search", {
      method: "POST",
      body: JSON.stringify(request)
    })
  }

  static async getUserStats(): Promise<UserStats> {
    return this.fetchAPI<UserStats>("/user/stats")
  }

  static async checkSearchAvailability(): Promise<boolean> {
    const stats = await this.getUserStats()
    return stats.searchesRemaining > 0
  }

  // Video Analysis APIs (FR-102, FR-103)
  static async analyzeVideo(
    request: VideoAnalysisRequest
  ): Promise<VideoAnalysisResponse> {
    return this.fetchAPI<VideoAnalysisResponse>("/video/analyze", {
      method: "POST",
      body: JSON.stringify(request)
    })
  }

  static async getVideoAnalysis(videoId: string): Promise<VideoAnalysisResponse> {
    return this.fetchAPI<VideoAnalysisResponse>(`/video/${videoId}/analysis`)
  }

  static async downloadReport(request: ReportDownloadRequest): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/video/${request.videoId}/report?format=${request.format}`,
      {
        method: "GET",
        headers: {
          Accept: request.format === "PDF" ? "application/pdf" : "text/plain"
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.statusText}`)
    }

    return response.blob()
  }

  static async getAnalysisHistory(): Promise<AnalysisHistoryResponse> {
    return this.fetchAPI<AnalysisHistoryResponse>("/video/history")
  }

  static async reAnalyzeVideo(videoId: string): Promise<VideoAnalysisResponse> {
    return this.analyzeVideo({ videoId, forceRefresh: true })
  }
}
