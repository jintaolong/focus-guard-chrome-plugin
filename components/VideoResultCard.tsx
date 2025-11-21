import type { VideoResult } from "~types"

interface VideoResultProps {
  video: VideoResult
}

export const VideoResultCard = ({ video }: VideoResultProps) => {
  const getSentimentColor = (
    sentiment: "positive" | "neutral" | "negative"
  ) => {
    switch (sentiment) {
      case "positive":
        return "#16a34a"
      case "neutral":
        return "#ca8a04"
      case "negative":
        return "#dc2626"
    }
  }

  const getSentimentIcon = (sentiment: "positive" | "neutral" | "negative") => {
    switch (sentiment) {
      case "positive":
        return "😊"
      case "neutral":
        return "😐"
      case "negative":
        return "😠"
    }
  }

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        backgroundColor: "white",
        border: "1px solid #e5e5e5",
        borderRadius: "12px",
        padding: "16px",
        textDecoration: "none",
        color: "inherit",
        transition: "all 0.2s",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)"
        e.currentTarget.style.borderColor = "#3b82f6"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none"
        e.currentTarget.style.borderColor = "#e5e5e5"
      }}>
      <div style={{ display: "flex", gap: "16px" }}>
        {/* Thumbnail */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            style={{
              width: "160px",
              height: "90px",
              objectFit: "cover",
              borderRadius: "8px",
              backgroundColor: "#f5f5f5"
            }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <h3
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#1a1a1a",
              marginBottom: "8px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical"
            }}>
            {video.title}
          </h3>

          {/* Channel & Metadata */}
          <div
            style={{
              fontSize: "13px",
              color: "#666",
              marginBottom: "12px"
            }}>
            <span>{video.channelName}</span>
            <span style={{ margin: "0 6px" }}>•</span>
            <span>{video.viewCount} views</span>
            <span style={{ margin: "0 6px" }}>•</span>
            <span>{video.duration}</span>
          </div>

          {/* Metrics */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap"
            }}>
            {/* Relevance Score */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                backgroundColor: "#f0f9ff",
                borderRadius: "6px",
                fontSize: "12px"
              }}>
              <span style={{ fontWeight: "600", color: "#0369a1" }}>
                {Math.round(video.relevanceScore * 100)}%
              </span>
              <span style={{ color: "#0369a1" }}>relevance</span>
            </div>

            {/* Transcript Sentiment */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                backgroundColor: "#fef3f2",
                borderRadius: "6px",
                fontSize: "12px"
              }}>
              <span>
                {getSentimentIcon(video.transcriptSentiment.label)}
              </span>
              <span
                style={{
                  color: getSentimentColor(video.transcriptSentiment.label)
                }}>
                Transcript
              </span>
            </div>

            {/* Comment Sentiment */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                backgroundColor: "#f0fdf4",
                borderRadius: "6px",
                fontSize: "12px"
              }}>
              <span>
                {getSentimentIcon(video.commentSentiment.label)}
              </span>
              <span
                style={{
                  color: getSentimentColor(video.commentSentiment.label)
                }}>
                Comments
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}
