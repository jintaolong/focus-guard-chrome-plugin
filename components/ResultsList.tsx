import { VideoResultCard } from "./VideoResultCard"

import type { VideoResult } from "~types"

interface ResultsListProps {
  results: VideoResult[]
  isLoading: boolean
}

export const ResultsList = ({ results, isLoading }: ResultsListProps) => {
  if (isLoading) {
    return (
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "40px 20px"
        }}>
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px"
          }}>
          <div
            style={{
              display: "inline-block",
              width: "40px",
              height: "40px",
              border: "4px solid #e5e5e5",
              borderTopColor: "#3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}
          />
          <p
            style={{
              marginTop: "16px",
              fontSize: "16px",
              color: "#666"
            }}>
            Analyzing and curating results...
          </p>
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "0 20px 40px"
      }}>
      {/* Results Header */}
      <div
        style={{
          marginBottom: "20px",
          paddingBottom: "16px",
          borderBottom: "1px solid #e5e5e5"
        }}>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#1a1a1a",
            marginBottom: "4px"
          }}>
          Top {results.length} Curated Results
        </h2>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Ranked by relevance and filtered based on your criteria
        </p>
      </div>

      {/* Results */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
        {results.map((video) => (
          <VideoResultCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  )
}
