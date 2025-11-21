import type { SearchRequest, SearchResponse, UserStats } from "~types"

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
}
