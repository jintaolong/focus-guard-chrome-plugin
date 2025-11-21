import { useState } from "react"

import type { UserStats } from "~types"

interface SearchInterfaceProps {
  onSearch: (query: string) => void
  isLoading: boolean
  userStats: UserStats | null
}

export const SearchInterface = ({
  onSearch,
  isLoading,
  userStats
}: SearchInterfaceProps) => {
  const [query, setQuery] = useState("")
  const [showExamples, setShowExamples] = useState(true)
  const [textareaHeight, setTextareaHeight] = useState("auto")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() && userStats && userStats.searchesRemaining > 0) {
      onSearch(query)
      setShowExamples(false)
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value)
    // Auto-resize textarea
    e.target.style.height = "auto"
    e.target.style.height = e.target.scrollHeight + "px"
  }

  const exampleQueries = [
    "Give me only objective explainers on climate change",
    "Show me Python tutorials excluding content with angry tone",
    "Summarize Veritasium's bias on science topics"
  ]

  const handleExampleClick = (example: string) => {
    setQuery(example)
  }

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px"
      }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "600",
            color: "#1a1a1a",
            marginBottom: "8px"
          }}>
          Focus Guard
        </h1>
        <p style={{ fontSize: "16px", color: "#666" }}>
          Curated, bias-aware YouTube search
        </p>
      </div>

      {/* Search Limit Indicator */}
      {userStats && (
        <div
          style={{
            backgroundColor: "#f5f5f5",
            padding: "12px 20px",
            borderRadius: "8px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
          <span style={{ fontSize: "14px", color: "#666" }}>
            {userStats.tier === "free" ? "Free Tier" : "Premium"}
          </span>
          <span
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color:
                userStats.searchesRemaining === 0 ? "#dc2626" : "#16a34a"
            }}>
            {userStats.searchesRemaining} searches remaining today
          </span>
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ position: "relative" }}>
          <textarea
            value={query}
            onChange={handleTextareaChange}
            placeholder="What would you like to watch?"
            disabled={isLoading || userStats?.searchesRemaining === 0}
            rows={1}
            style={{
              width: "100%",
              minHeight: "60px",
              maxHeight: "300px",
              padding: "20px 24px",
              fontSize: "24px",
              fontWeight: "400",
              lineHeight: "1.4",
              border: "2px solid #e5e5e5",
              borderRadius: "16px",
              resize: "none",
              overflow: "hidden",
              fontFamily: "inherit",
              outline: "none",
              transition: "border-color 0.3s, box-shadow 0.3s",
              backgroundColor:
                userStats?.searchesRemaining === 0 ? "#fafafa" : "white",
              boxSizing: "border-box"
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6"
              e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)"
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e5e5e5"
              e.target.style.boxShadow = "none"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={
            !query.trim() ||
            isLoading ||
            userStats?.searchesRemaining === 0
          }
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "14px",
            fontSize: "16px",
            fontWeight: "600",
            color: "white",
            backgroundColor:
              !query.trim() ||
              isLoading ||
              userStats?.searchesRemaining === 0
                ? "#9ca3af"
                : "#3b82f6",
            border: "none",
            borderRadius: "8px",
            cursor:
              !query.trim() ||
              isLoading ||
              userStats?.searchesRemaining === 0
                ? "not-allowed"
                : "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => {
            if (
              query.trim() &&
              !isLoading &&
              userStats?.searchesRemaining !== 0
            ) {
              e.currentTarget.style.backgroundColor = "#2563eb"
            }
          }}
          onMouseLeave={(e) => {
            if (
              query.trim() &&
              !isLoading &&
              userStats?.searchesRemaining !== 0
            ) {
              e.currentTarget.style.backgroundColor = "#3b82f6"
            }
          }}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Example Queries */}
      {showExamples && (
        <div style={{ marginTop: "32px" }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#666",
              marginBottom: "12px"
            }}>
            Try these examples:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {exampleQueries.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                disabled={userStats?.searchesRemaining === 0}
                style={{
                  padding: "12px 16px",
                  fontSize: "14px",
                  color: "#3b82f6",
                  backgroundColor: "white",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  cursor:
                    userStats?.searchesRemaining === 0
                      ? "not-allowed"
                      : "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  opacity: userStats?.searchesRemaining === 0 ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (userStats?.searchesRemaining !== 0) {
                    e.currentTarget.style.backgroundColor = "#f0f9ff"
                    e.currentTarget.style.borderColor = "#3b82f6"
                  }
                }}
                onMouseLeave={(e) => {
                  if (userStats?.searchesRemaining !== 0) {
                    e.currentTarget.style.backgroundColor = "white"
                    e.currentTarget.style.borderColor = "#e5e5e5"
                  }
                }}>
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Out of searches message */}
      {userStats?.searchesRemaining === 0 && (
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            textAlign: "center"
          }}>
          <p style={{ fontSize: "14px", color: "#991b1b", marginBottom: "8px" }}>
            You've used all your searches for today
          </p>
          <p style={{ fontSize: "12px", color: "#dc2626" }}>
            Resets at {new Date(userStats.resetTime).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  )
}
