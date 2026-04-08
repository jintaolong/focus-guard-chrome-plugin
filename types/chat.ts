// Types for the Chat Dialog feature

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  created_at?: string
}

export interface ChatError {
  code: string
  message: string
  retryable: boolean
}

// Available chat models
export interface ChatModel {
  id: string
  label: string
  band: "premium" | "mid"
}

export const CHAT_MODELS: ChatModel[] = [
  // Canonical IDs match backend: aliases like gpt-5.4 → gpt-5-4 are normalised server-side
  { id: "gpt-5-4", label: "GPT-5.4", band: "premium" },
  { id: "claude-4-6-sonnet", label: "Claude 4.6 Sonnet", band: "premium" },
  { id: "gemini-3-pro", label: "Gemini 3 Pro", band: "premium" },
  { id: "llama-4-maverick", label: "Llama 4 Maverick", band: "mid" },
  { id: "gpt-oss-120b", label: "GPT-OSS 120B", band: "mid" },
]

// Meme generation response
export interface MemeResponse {
  image_url: string
  overlay_text: { top: string; bottom: string }
  image_prompt: string
  provider_used: string
  resolution: string
}

// Port message types — Panel → Background
export interface ChatRequestMessage {
  type: "CHAT_REQUEST"
  payload: {
    session_id: string
    message: string
    history: ChatMessage[]
    model_id?: string
  }
}

// Port message types — Background → Panel
export interface ChatTokenMessage {
  type: "CHAT_TOKEN"
  token: string
}

export interface ChatDoneMessage {
  type: "CHAT_DONE"
}

export interface ChatErrorMessage {
  type: "CHAT_ERROR"
  code: string
  message: string
}

// Citation metadata emitted before [DONE] when the assistant referenced comments
export interface ChatCitationsMessage {
  type: "CHAT_CITATIONS"
  // Map of citation index → comment object
  citations: Record<string, { comment_id: string; author: string; text: string; like_count: number; is_reply: boolean }>
}

export interface ChatThinkingMessage {
  type: "CHAT_THINKING"
  chunks: string[]
}

export type ChatPortMessage =
  | ChatRequestMessage
  | ChatTokenMessage
  | ChatDoneMessage
  | ChatErrorMessage
  | ChatCitationsMessage
  | ChatThinkingMessage

// Session creation response
export interface ChatSessionResponse {
  session_id: string
  max_turns?: number
}

// Persisted chat history response
export interface ChatSessionHistoryResponse {
  session_id: string
  video_id: string
  snapshot_id: number | null
  turn_count: number
  messages: ChatMessage[]
}

// Chat state for the panel
export interface ChatState {
  sessionId: string | null
  history: ChatMessage[]
  streamingContent: string
  isStreaming: boolean
  inputValue: string
  error: ChatError | null
  turnCount: number
  maxTurns: number
}

// SSE parsing types
export interface ParsedSSEEvent {
  type: string // "message" (default) or named event type
  data: string
}

export interface ExtractResult {
  parsed: ParsedSSEEvent[]
  remainder: string
}
