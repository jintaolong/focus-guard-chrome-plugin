// SSE (Server-Sent Events) stream parser utilities for chat feature

import type { ParsedSSEEvent, ExtractResult } from "~types/chat"

/**
 * Parse raw SSE bytes from a stream buffer.
 * Returns fully-formed events and the unconsumed remainder.
 */
export function extractSSEEvents(buffer: string): ExtractResult {
  const events: ParsedSSEEvent[] = []
  const blocks = buffer.split("\n\n")
  const remainder = blocks.pop() ?? "" // Last block may be incomplete

  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split("\n")
    let eventType = "message"
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim()
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart())
      }
    }

    if (dataLines.length > 0) {
      events.push({ type: eventType, data: dataLines.join("\n") })
    }
  }

  return { parsed: events, remainder }
}


