# Comment Verdict — Chat Dialog Feature
## Chrome Extension Functional Requirements
### Version 1.0 | React + Vite | Chrome Side Panel | Background Service Worker

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [The SSE Streaming Problem and Solution](#3-the-sse-streaming-problem-and-solution)
4. [State Management](#4-state-management)
5. [Background Service Worker](#5-background-service-worker)
6. [React Side Panel — Component Architecture](#6-react-side-panel--component-architecture)
7. [Session Lifecycle](#7-session-lifecycle)
8. [Chat Turn Lifecycle](#8-chat-turn-lifecycle)
9. [Default Action Buttons — Meme and Clip](#9-default-action-buttons--meme-and-clip)
10. [Error Handling and Edge Cases](#10-error-handling-and-edge-cases)
11. [SSE Token Decoding](#11-sse-token-decoding)
12. [Configuration and Constants](#12-configuration-and-constants)
13. [File and Module Structure](#13-file-and-module-structure)
14. [Test Requirements](#14-test-requirements)

---

## 1. Overview

This document specifies the Chrome extension implementation for the Comment Verdict chat dialog feature. The chat dialog is a new section within the existing side panel, rendered after an analysis session has been created. It allows users to send freeform messages grounded in the video's comment analysis, and to trigger default media generation actions (meme, clip).

### 1.1 Key design decisions

**Port-based streaming bridge.** The existing background worker ↔ side panel communication uses `chrome.runtime.sendMessage`/`onMessage`, which is request-response only — unsuitable for streaming. For chat turns, the extension upgrades to a `chrome.runtime.connect` Port connection for the duration of each turn. The Port allows the background worker to push token messages to the panel in real time. All non-streaming communication (session creation, default actions, existing analysis calls) continues to use `sendMessage` unchanged.

**Session state in `chrome.storage.session`.** The chat `session_id`, turn count, and conversation history are stored in `chrome.storage.session` alongside the existing analysis results. This means state survives side panel closes and reopens within the same browser session, but is cleared on browser restart — appropriate for ephemeral analysis sessions.

**Conversation history owned by the panel.** The panel maintains the full conversation history array in React state, mirrored to `chrome.storage.session` after each completed turn. On mount, the panel restores history from storage. The background worker is stateless with respect to conversation history — it receives the full history on every chat request and forwards it to the backend.

**User identity.** The existing `user_id` stored in `chrome.storage` is attached to the `POST /sessions` request body. No new auth mechanism is introduced.

**Newline unescaping.** The backend SSE stream encodes literal newlines in tokens as the two-character sequence `\n` (backslash + n). The extension must unescape this before appending tokens to the UI.

### 1.2 Out of scope

- Meme and clip generation backend implementation (specified in backend FR).
- Changes to the existing analysis pipeline UI.
- Extension settings page.

---

## 2. Architecture Summary

```
YouTube Page (content script)
    │  Extracts: video_id, video_title, channel_name, comments
    │
    ▼ chrome.runtime.sendMessage("ANALYSIS_COMPLETE", { report, comments, metadata })
Background Service Worker
    │
    │  On ANALYSIS_COMPLETE:
    │    POST /sessions → receives session_id
    │    Stores { session_id, report, comments, metadata, turn_count: 0 }
    │    in chrome.storage.session
    │
    ▼ chrome.runtime.sendMessage response / storage event
React Side Panel
    │
    ├─ Reads session state from chrome.storage.session on mount
    ├─ Renders <AnalysisView> (existing) + <ChatPanel> (new, below analysis)
    │
    │  User submits message:
    │    Panel opens Port: chrome.runtime.connect({ name: "CHAT_STREAM" })
    │    Panel sends: port.postMessage({ type: "CHAT_REQUEST", payload: { session_id, message, history } })
    │
    ▼ Port message to Background Service Worker
Background Service Worker
    │  Receives CHAT_REQUEST on Port
    │  Opens fetch() SSE stream to POST /chat/{session_id}
    │  For each SSE token: port.postMessage({ type: "CHAT_TOKEN", token })
    │  On [DONE]:   port.postMessage({ type: "CHAT_DONE" })
    │  On error:    port.postMessage({ type: "CHAT_ERROR", code, message })
    │
    ▼ Port messages to React Side Panel
React Side Panel
    │  Appends each token to the streaming assistant message in state
    │  On CHAT_DONE: finalises message, saves history to storage, disconnects Port
    │  On CHAT_ERROR: shows error UI, disconnects Port
```

---

## 3. The SSE Streaming Problem and Solution

### 3.1 Why `sendMessage` cannot carry a stream

`chrome.runtime.sendMessage` is a one-shot request/response — the background worker sends exactly one response per message. There is no mechanism to send multiple incremental responses for a single request. If the background worker attempted to buffer the entire SSE stream and respond once it was complete, the user would see no output until the LLM finished generating — defeating the purpose of streaming.

### 3.2 Solution: `chrome.runtime.connect` Port per chat turn

`chrome.runtime.connect` creates a persistent bidirectional message channel (a `Port`) between the panel and the background worker. The panel initiates the Port, sends one `CHAT_REQUEST` message, and then receives an arbitrary number of `CHAT_TOKEN` messages from the worker until a `CHAT_DONE` or `CHAT_ERROR` message closes the exchange.

The Port is opened at the start of each chat turn and disconnected after `CHAT_DONE` or `CHAT_ERROR` is received. Only one Port is open at a time per tab (the UI enforces this by disabling input while a turn is in progress).

### 3.3 Port naming convention

The Port is opened with `name: "CHAT_STREAM"`. The background worker's `chrome.runtime.onConnect` listener checks `port.name === "CHAT_STREAM"` before handling. All other Port connections (if any are added in future) use different names.

### 3.4 Port message protocol

All messages are plain objects with a `type` discriminant.

**Panel → Worker (sent once per turn):**
```typescript
{
  type: "CHAT_REQUEST";
  payload: {
    session_id: string;
    message: string;
    history: ChatMessage[];
  };
}
```

**Worker → Panel (sent N times per turn):**
```typescript
{ type: "CHAT_TOKEN"; token: string }
{ type: "CHAT_DONE" }
{ type: "CHAT_ERROR"; code: string; message: string }
```

The worker sends exactly one of `CHAT_DONE` or `CHAT_ERROR` as the final message per turn. After sending it, the worker calls `port.disconnect()`. The panel also calls `port.disconnect()` in its `onDisconnect` handler to clean up.

### 3.5 Service worker lifetime and Port resilience

Chrome's Manifest V3 background service workers can be terminated by the browser after ~30 seconds of inactivity and restarted on demand. A Port connection keeps the service worker alive for as long as the Port is open. Since a chat turn's SSE stream can take up to 30–60 seconds for long responses, the open Port is sufficient to prevent premature termination during a turn.

However, the service worker can be terminated abruptly if the browser decides to do so (e.g. memory pressure). If the Port disconnects unexpectedly (i.e. `port.onDisconnect` fires without the panel having received `CHAT_DONE` or `CHAT_ERROR`), the panel must treat this as an error and display an error state with a retry option.

Detection: the panel tracks a boolean `streamCompleted` flag. It is set to `true` only when `CHAT_DONE` is received. In `port.onDisconnect`, if `streamCompleted` is `false`, the panel shows the error state `"connection_lost"`.

---

## 4. State Management

### 4.1 `chrome.storage.session` schema

The following keys are written and read by the extension. All keys are namespaced with `cv_` to avoid collisions.

```typescript
interface CVSessionStorage {
  cv_session_id: string | null;            // Backend chat session ID (UUID4)
  cv_user_id: string;                      // Existing — user identity
  cv_video_id: string | null;              // Current YouTube video ID
  cv_video_metadata: VideoMetadata | null; // Full metadata object
  cv_comments: Comment[] | null;           // 100–1000 comment objects
  cv_report: AnalysisReport | null;        // Structured analysis report
  cv_turn_count: number;                   // Local mirror of turn count (for UI display)
  cv_chat_history: ChatMessage[];          // Full conversation history
  cv_session_status: SessionStatus;        // See 4.2
}
```

`cv_chat_history` and `cv_turn_count` are new keys introduced by this feature. All others are pre-existing or assumed to already exist.

### 4.2 `SessionStatus` enum

```typescript
type SessionStatus =
  | "idle"           // No analysis run yet for this video
  | "analysing"      // Analysis pipeline in progress
  | "ready"          // Analysis complete, session_id obtained, chat available
  | "error"          // Session creation or analysis failed
```

The chat panel is only rendered when `cv_session_status === "ready"`.

### 4.3 React state — `useChatStore` hook

Local React state for the chat panel. Not persisted between renders — reconstructed from `chrome.storage.session` on mount.

```typescript
interface ChatState {
  history: ChatMessage[];              // Full conversation history
  streamingContent: string;            // Accumulated tokens for the in-progress turn
  isStreaming: boolean;                // True while a turn's Port is open
  inputValue: string;                  // Controlled input field value
  error: ChatError | null;             // Current error state, if any
  turnCount: number;                   // Local mirror from storage
  maxTurns: number;                    // From CHAT_MAX_TURNS_PER_SESSION constant
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatError {
  code: string;
  message: string;
  retryable: boolean;
}
```

### 4.4 Storage synchronisation

On mount, `useChatStore` calls `chrome.storage.session.get(["cv_chat_history", "cv_turn_count"])` and initialises `history` and `turnCount` from the stored values (defaulting to `[]` and `0` respectively).

After each completed turn (`CHAT_DONE` received), the hook writes `cv_chat_history` and `cv_turn_count` back to `chrome.storage.session`. This write is fire-and-forget (no await in the render path) but errors are logged.

When the video changes (detected via `cv_video_id` changing in storage), `useChatStore` resets `history` to `[]` and `turnCount` to `0`, and clears `cv_chat_history` and `cv_turn_count` from storage.

---

## 5. Background Service Worker

### 5.1 Existing architecture constraint

The background service worker currently uses `chrome.runtime.onMessage` for all communication. This feature adds a `chrome.runtime.onConnect` listener alongside the existing `onMessage` listener. The two listeners are independent and do not interfere with each other.

### 5.2 New listener: `chrome.runtime.onConnect`

```typescript
chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  if (port.name !== "CHAT_STREAM") return;
  handleChatStreamPort(port);
});
```

### 5.3 `handleChatStreamPort(port)`

```typescript
async function handleChatStreamPort(port: chrome.runtime.Port): Promise<void> {
  port.onMessage.addListener(async (msg: PortMessage) => {
    if (msg.type !== "CHAT_REQUEST") return;
    await streamChatRequest(port, msg.payload);
  });
}
```

### 5.4 `streamChatRequest(port, payload)`

This function owns the full lifecycle of one chat turn: fetch, SSE parsing, token forwarding, and error handling.

```typescript
async function streamChatRequest(
  port: chrome.runtime.Port,
  payload: ChatRequestPayload,
): Promise<void> {
  const { session_id, message, history } = payload;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/chat/${session_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
      signal: AbortSignal.timeout(90_000),  // 90s hard timeout
    });
  } catch (err) {
    port.postMessage({
      type: "CHAT_ERROR",
      code: "network_error",
      message: "Could not reach the server.",
    });
    port.disconnect();
    return;
  }

  if (!response.ok) {
    const errorPayload = await parseErrorResponse(response);
    port.postMessage({ type: "CHAT_ERROR", ...errorPayload });
    port.disconnect();
    return;
  }

  // SSE stream reading
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = extractSSEEvents(buffer);
      buffer = events.remainder;

      for (const event of events.parsed) {
        if (event.type === "error") {
          const errData = JSON.parse(event.data);
          port.postMessage({
            type: "CHAT_ERROR",
            code: errData.code,
            message: errData.message,
          });
          port.disconnect();
          return;
        }
        if (event.data === "[DONE]") {
          port.postMessage({ type: "CHAT_DONE" });
          port.disconnect();
          return;
        }
        // Regular token
        const token = unescapeSSENewlines(event.data);
        port.postMessage({ type: "CHAT_TOKEN", token });
      }
    }
    // Stream ended without [DONE] — treat as completion
    port.postMessage({ type: "CHAT_DONE" });
    port.disconnect();
  } catch (err) {
    port.postMessage({
      type: "CHAT_ERROR",
      code: "stream_read_error",
      message: "Stream interrupted.",
    });
    port.disconnect();
  } finally {
    reader.releaseLock();
  }
}
```

### 5.5 `extractSSEEvents(buffer)`

Parses raw SSE bytes from the stream buffer. Returns fully-formed events and the unconsumed remainder.

```typescript
interface ParsedSSEEvent {
  type: string;   // "message" (default) or named event type
  data: string;
}

interface ExtractResult {
  parsed: ParsedSSEEvent[];
  remainder: string;
}

function extractSSEEvents(buffer: string): ExtractResult {
  const events: ParsedSSEEvent[] = [];
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() ?? "";  // Last block may be incomplete

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    let eventType = "message";
    let dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length > 0) {
      events.push({ type: eventType, data: dataLines.join("\n") });
    }
  }

  return { parsed: events, remainder };
}
```

### 5.6 `unescapeSSENewlines(token)`

The backend escapes literal newlines in tokens as the two-character sequence `\n` (backslash + n). This must be unescaped before the token is displayed.

```typescript
function unescapeSSENewlines(token: string): string {
  return token.replace(/\\n/g, "\n");
}
```

Note: this replaces the two-character string `\n` (char 92 + char 110) with a real newline character (char 10). It does not affect tokens that already contain real newlines (which would only appear if the SSE framing was broken — `extractSSEEvents` handles that).

### 5.7 `parseErrorResponse(response)`

Converts non-2xx HTTP responses into a structured error payload for the Port.

```typescript
async function parseErrorResponse(
  response: Response,
): Promise<{ code: string; message: string }> {
  const status = response.status;
  try {
    const body = await response.json();
    const detail = body?.detail ?? "unknown_error";
    return {
      code: detail,
      message: HTTP_ERROR_MESSAGES[detail] ?? `Request failed (${status})`,
    };
  } catch {
    return {
      code: "parse_error",
      message: `Request failed (${status})`,
    };
  }
}

const HTTP_ERROR_MESSAGES: Record<string, string> = {
  session_not_found: "This session has expired. Please run a new analysis.",
  turn_limit_exceeded: "You've reached the maximum number of turns for this session.",
  insufficient_credits: "You don't have enough credits.",
};
```

### 5.8 Session creation — `sendMessage` handler (existing pattern)

Session creation (`POST /sessions`) uses the existing `sendMessage`/`onMessage` pattern since it is a standard request-response call.

The background worker's existing `onMessage` handler is extended with a new case:

```typescript
case "CREATE_CHAT_SESSION": {
  const { user_id, video_metadata, comments, report } = msg.payload;
  try {
    const res = await fetch(`${API_BASE_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, video_metadata, comments, report }),
    });
    if (!res.ok) {
      const err = await parseErrorResponse(res);
      sendResponse({ success: false, ...err });
      return;
    }
    const data = await res.json();
    // Store session_id and reset chat state
    await chrome.storage.session.set({
      cv_session_id: data.session_id,
      cv_turn_count: 0,
      cv_chat_history: [],
      cv_session_status: "ready",
    });
    sendResponse({
      success: true,
      session_id: data.session_id,
      credits_remaining: data.credits_remaining,
      max_turns: data.max_turns,
    });
  } catch (err) {
    sendResponse({ success: false, code: "network_error", message: "Could not reach server." });
  }
  return true;  // Keep message channel open for async response
}
```

---

## 6. React Side Panel — Component Architecture

### 6.1 Component tree

```
<SidePanel>                         (root, existing)
  ├─ <AnalysisView>                 (existing — unchanged)
  └─ <ChatPanel>                    (new — rendered only when status === "ready")
       ├─ <ChatHeader>              (title, turn counter, session info)
       ├─ <ChatMessageList>         (scrollable message history)
       │    ├─ <UserMessage>        (one per user turn)
       │    ├─ <AssistantMessage>   (one per assistant turn, supports streaming)
       │    └─ <StreamingMessage>   (the in-progress assistant message while streaming)
       ├─ <DefaultActions>          (meme + clip buttons, shown when history is empty or on demand)
       └─ <ChatInputBar>            (textarea + send button)
```

### 6.2 `<ChatPanel>`

The root chat component. Owns `useChatStore`. Manages the Port lifecycle.

**Props**: none (reads all state from storage and hook).

**Responsibilities**:
- On mount: initialise `useChatStore` from `chrome.storage.session`.
- Render `<ChatHeader>`, `<ChatMessageList>`, `<DefaultActions>`, `<ChatInputBar>`.
- Pass `onSubmit` (triggers a chat turn) and `isStreaming` down to child components.
- Open and close the Port for each turn (see Section 8).
- On `cv_video_id` storage change: reset chat state.

### 6.3 `<ChatHeader>`

Displays:
- Static title: "Comment Verdict AI"
- Turn counter: `{turnCount} / {maxTurns} turns used` — rendered as a small muted label.
- When `turnCount >= maxTurns`: replace turn counter with a warning badge: "Turn limit reached".

### 6.4 `<ChatMessageList>`

A vertically scrollable container. Renders:
- One `<UserMessage>` or `<AssistantMessage>` per item in `history`.
- One `<StreamingMessage>` when `isStreaming === true`, showing `streamingContent`.

**Auto-scroll behaviour**: after each token append and after each new message is added, scroll the container to its bottom. Use a `ref` on the container and call `ref.current.scrollTop = ref.current.scrollHeight` inside a `useEffect` that depends on `streamingContent` and `history.length`.

**Empty state**: when `history.length === 0` and `isStreaming === false`, render a placeholder: "Ask anything about this video's comments."

### 6.5 `<UserMessage>`

Renders the user's message text in a visually distinct style (right-aligned or distinct background). No markdown rendering — plain text only.

### 6.6 `<AssistantMessage>`

Renders a completed assistant message. Supports markdown rendering via a lightweight library (e.g. `react-markdown` with `remark-gfm`). This enables the model's formatted output (bullet lists, bold text, code spans) to render correctly.

### 6.7 `<StreamingMessage>`

Renders the currently streaming assistant response. Shows `streamingContent` with a blinking cursor appended. Uses the same markdown renderer as `<AssistantMessage>` but re-renders on every token append. A blinking CSS cursor (`|`) is appended to the rendered content while `isStreaming === true`.

Performance note: because `streamingContent` updates on every token (potentially 10–30 times per second), `<StreamingMessage>` must not cause the entire `<ChatMessageList>` to re-render. It is wrapped in `React.memo` and receives only `streamingContent` as a prop.

### 6.8 `<DefaultActions>`

Renders two action buttons: "Create meme" and "Create clip".

**Visibility rules**:
- Always visible when `history.length === 0`.
- Accessible via a "Suggested actions" toggle button below the message list when `history.length > 0`.
- Hidden while `isStreaming === true`.
- Disabled while `isStreaming === true` (belt-and-suspenders).

**On click**: dispatches a `sendMessage` call to the background worker for the respective generation action. Transitions to a loading state on the button. See Section 9.

### 6.9 `<ChatInputBar>`

A `<textarea>` and send `<button>`.

**Behaviour**:
- `<textarea>` auto-resizes vertically up to a max of 5 lines (CSS `min-height` + `max-height` + `overflow-y: auto`).
- Send on `Enter` (without Shift). `Shift+Enter` inserts a newline.
- Send button and textarea are disabled while `isStreaming === true`.
- Send button and textarea are disabled when `turnCount >= maxTurns`.
- When disabled due to turn limit: show tooltip on hover: "Turn limit reached for this session."
- Input is cleared immediately on send (optimistic clear, before the stream starts).
- `maxLength` attribute set to `4000` on the textarea.

---

## 7. Session Lifecycle

### 7.1 Trigger: analysis completes

When the analysis pipeline completes (existing flow), the content script or existing background logic already stores the report, comments, and metadata. At this point, the extension must additionally call `CREATE_CHAT_SESSION` to obtain a `session_id` from the backend.

The `CREATE_CHAT_SESSION` call is triggered from the background worker immediately after analysis completes and results are stored, as part of the existing analysis completion handler. It is not triggered from the panel — the panel reads the resulting `session_id` from storage.

### 7.2 Session creation sequence

```
1. Analysis completes → results stored in chrome.storage.session.
2. Background worker sends CREATE_CHAT_SESSION to itself
   (or calls the function directly if the trigger is internal).
3. POST /sessions with { user_id, video_metadata, comments, report }.
4. On 201: store session_id, reset cv_chat_history=[], cv_turn_count=0,
           set cv_session_status="ready".
5. On 402 (insufficient credits): set cv_session_status="error";
   store cv_session_error="insufficient_credits".
6. On any other error: set cv_session_status="error";
   store cv_session_error="session_creation_failed".
```

### 7.3 Panel reads session state on mount

```typescript
useEffect(() => {
  chrome.storage.session.get([
    "cv_session_id",
    "cv_session_status",
    "cv_chat_history",
    "cv_turn_count",
    "cv_session_error",
  ]).then((stored) => {
    setSessionId(stored.cv_session_id ?? null);
    setStatus(stored.cv_session_status ?? "idle");
    setHistory(stored.cv_chat_history ?? []);
    setTurnCount(stored.cv_turn_count ?? 0);
  });
}, []);
```

A `chrome.storage.onChanged` listener is also registered so that if the background worker completes session creation while the panel is open (e.g. analysis finishes while user has panel open), the panel re-reads and transitions to the `ready` state without requiring a panel close-reopen.

### 7.4 Video change detection

The panel listens for changes to `cv_video_id` in `chrome.storage.onChanged`. When `cv_video_id` changes:
1. Reset `history` to `[]`, `turnCount` to `0`, `streamingContent` to `""`.
2. Set `status` to `"idle"` or `"analysing"` depending on the current `cv_session_status`.
3. Clear `cv_chat_history` and `cv_turn_count` from storage.

---

## 8. Chat Turn Lifecycle

### 8.1 Preconditions

A chat turn may only begin when all of the following are true:
- `status === "ready"`
- `isStreaming === false`
- `turnCount < maxTurns`
- `inputValue.trim().length > 0`
- `inputValue.trim().length <= 4000`

These conditions are enforced by disabling the send button and input when any condition fails. The `onSubmit` handler also checks them and returns early if violated.

### 8.2 Turn sequence

```
1. Read session_id and history from state.
2. Add { role: "user", content: inputValue.trim() } to history (optimistic).
3. Clear inputValue.
4. Set isStreaming = true, streamingContent = "".
5. Open Port: const port = chrome.runtime.connect({ name: "CHAT_STREAM" }).
6. Register port.onMessage handler (see 8.3).
7. Register port.onDisconnect handler (see 8.4).
8. Send: port.postMessage({ type: "CHAT_REQUEST", payload: { session_id, message, history } }).
   Note: `history` in the payload is the history BEFORE the new user message
   was added — matching the backend's expected format of history[] + message separately.
   Alternatively, send the prior history (without the new user message) and let the
   backend prepend it. Either convention is acceptable; this spec uses the latter
   (prior history only in `history`, new message as `message`).
```

### 8.3 `port.onMessage` handler

```typescript
port.onMessage.addListener((msg: PortMessage) => {
  switch (msg.type) {
    case "CHAT_TOKEN":
      setStreamingContent(prev => prev + msg.token);
      break;

    case "CHAT_DONE":
      streamCompleted = true;
      const finalContent = streamingContentRef.current;
      setHistory(prev => [
        ...prev,
        { role: "assistant", content: finalContent },
      ]);
      setStreamingContent("");
      setIsStreaming(false);
      setTurnCount(prev => prev + 1);
      // Persist to storage
      chrome.storage.session.set({
        cv_chat_history: updatedHistory,
        cv_turn_count: newTurnCount,
      });
      port.disconnect();
      break;

    case "CHAT_ERROR":
      streamCompleted = true;
      setIsStreaming(false);
      setStreamingContent("");
      setError({ code: msg.code, message: msg.message, retryable: isRetryable(msg.code) });
      port.disconnect();
      break;
  }
});
```

`streamingContentRef` is a `useRef` that mirrors `streamingContent` state to allow reading the latest value inside the closure without stale closure issues.

`isRetryable(code)` returns `true` for `"network_error"`, `"stream_read_error"`, `"upstream_unavailable"`, and `"connection_lost"`. Returns `false` for `"session_not_found"` and `"turn_limit_exceeded"`.

### 8.4 `port.onDisconnect` handler

```typescript
port.onDisconnect.addListener(() => {
  if (!streamCompleted) {
    setIsStreaming(false);
    setStreamingContent("");
    setError({
      code: "connection_lost",
      message: "Connection to the extension was interrupted. Please try again.",
      retryable: true,
    });
  }
});
```

### 8.5 Retry behaviour

When `error.retryable === true`, the error display includes a "Try again" button. Clicking it:
1. Removes the last user message from `history` (since it was added optimistically and the assistant never responded).
2. Restores `inputValue` to the content of that removed user message.
3. Clears the error state.

The user can then re-submit. This does not automatically retry — the user must explicitly press send again.

---

## 9. Default Action Buttons — Meme and Clip

### 9.1 Overview

The "Create meme" and "Create clip" buttons each trigger a `sendMessage` call (not a Port connection — these are request-response calls). The background worker sends a `POST` request to the respective backend endpoint, receives a URL in the response, and returns it to the panel.

### 9.2 Message types

```typescript
// Panel → Worker
{ type: "GENERATE_MEME"; payload: { session_id: string } }
{ type: "GENERATE_CLIP"; payload: { session_id: string } }

// Worker → Panel (response)
{ success: true; url: string }
{ success: false; code: string; message: string }
```

### 9.3 Loading state

While a generation request is in progress:
- The clicked button shows a spinner and its label changes to "Generating…".
- The other generation button is disabled.
- The chat input remains enabled (generation and chat can run concurrently).

### 9.4 Meme result display

On successful meme generation:
1. An `<AssistantMessage>`-style bubble is appended to the message list (not added to `history` since it is not a conversational exchange).
2. The bubble contains the generated image rendered as `<img src={url} alt="Generated meme" style={{ maxWidth: "100%" }} />`.
3. A "Download" link is rendered below the image: `<a href={url} download>Download</a>`.
4. A "Share" button copies the image URL to the clipboard and shows a transient "Copied!" confirmation.

Meme results are not persisted to `cv_chat_history` — they are ephemeral UI elements lost on panel close.

### 9.5 Clip result display

On successful clip generation:
1. An `<AssistantMessage>`-style bubble is appended.
2. The bubble contains an `<audio controls src={url} />` element for the narration.
3. A branded card image (returned as a separate URL or embedded in the same response) is shown above the audio player as `<img>`.
4. A "Download" link for the audio file.

### 9.6 Error handling for generation actions

On failure, an inline error message is shown beneath the clicked button: `"Could not generate {meme/clip}. Please try again."` The button returns to its default state. The error is dismissable by clicking an `×` icon.

---

## 10. Error Handling and Edge Cases

### 10.1 Error display

Errors are shown as a dismissable banner above the `<ChatInputBar>`:

```
┌─────────────────────────────────────────────┐
│ ⚠  {error.message}        [Try again] [✕] │
└─────────────────────────────────────────────┘
```

"Try again" is only shown when `error.retryable === true`.

Dismissing the error (clicking `✕`) clears the error state and, if the last message in history is a user message with no assistant reply, removes it (rolls back the optimistic append).

### 10.2 Session expired mid-session

If `CHAT_ERROR` with `code: "session_not_found"` is received mid-session (the backend 30-minute TTL expired while the panel was open):
- Display: "This session has expired. Please run a new analysis to continue."
- The chat input is disabled.
- A "Re-analyse" button is shown that triggers the existing analysis flow.

### 10.3 Insufficient credits

If `cv_session_error === "insufficient_credits"` when the panel mounts (set during session creation failure):
- The chat panel is not rendered.
- Instead, render: "You don't have enough credits to start a chat session. Please purchase more credits."
- Link to the credit purchase page (URL from `CREDITS_URL` constant).

### 10.4 Turn limit reached

When `turnCount >= maxTurns`:
- `<ChatInputBar>` textarea and button are disabled.
- `<ChatHeader>` shows: "Turn limit reached (20/20)."
- A message is shown at the bottom of the message list: "You've reached the maximum number of turns for this session. Start a new analysis to begin a new session."

### 10.5 Concurrent tab protection

The extension should not allow two chat streams to be open simultaneously. Since `isStreaming` is React state scoped to the panel, and the side panel is a single instance per browser window, this is naturally enforced by the disabled input during streaming. No additional cross-tab locking is required.

### 10.6 Panel closed during streaming

If the user closes the side panel while a stream is in progress:
- React component unmounts.
- The `useEffect` cleanup in `useChatStore` calls `port.disconnect()`.
- The background worker receives `port.onDisconnect` and aborts the `fetch()` (via an `AbortController` that is cancelled in the Port's disconnect handler).
- The in-progress turn is lost. On next panel open, the last user message (which was optimistically added) will not be in `cv_chat_history` (since storage is only written on `CHAT_DONE`). This is acceptable behaviour.

Abort implementation in `streamChatRequest`:
```typescript
const abortController = new AbortController();
port.onDisconnect.addListener(() => abortController.abort());
// Pass signal to fetch()
```

---

## 11. SSE Token Decoding

This section consolidates the token decoding contract between backend and extension.

### 11.1 Backend encoding convention

The backend replaces each literal `\n` (newline character, char 10) in a token with the two-character sequence `\n` (backslash char 92 + `n` char 110) before placing it in the SSE `data:` field.

Example: a token containing `"line1\nline2"` (with a real newline) is transmitted as `data: line1\nline2\n\n` in the SSE stream.

### 11.2 Extension decoding

`unescapeSSENewlines(token)` reverses this:
```typescript
token.replace(/\\n/g, "\n")
```

This regex replaces every occurrence of the literal two-character sequence `\n` with a real newline. It does not affect tokens that do not contain this sequence.

### 11.3 Markdown rendering

Because assistant messages are rendered via `react-markdown`, real newlines in the finalised content are handled naturally by the markdown renderer (rendered as paragraph breaks or list items depending on context). The unescaping must occur in the background worker before the token is forwarded to the panel — the panel receives already-unescaped tokens and concatenates them directly.

---

## 12. Configuration and Constants

### 12.1 `src/constants.ts`

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
export const CHAT_MAX_TURNS_PER_SESSION = 20;  // Must match backend CHAT_MAX_TURNS_PER_SESSION
export const CREDITS_URL = "https://commentverdict.com/credits";  // Update before release
export const STREAM_TIMEOUT_MS = 90_000;
export const STORAGE_KEYS = {
  SESSION_ID: "cv_session_id",
  USER_ID: "cv_user_id",
  VIDEO_ID: "cv_video_id",
  VIDEO_METADATA: "cv_video_metadata",
  COMMENTS: "cv_comments",
  REPORT: "cv_report",
  TURN_COUNT: "cv_turn_count",
  CHAT_HISTORY: "cv_chat_history",
  SESSION_STATUS: "cv_session_status",
  SESSION_ERROR: "cv_session_error",
} as const;
```

`CHAT_MAX_TURNS_PER_SESSION` in the frontend is a display constant only — enforcement is on the backend. If the backend returns a `max_turns` value in the `POST /sessions` response, the panel should use that value instead of the hardcoded constant, to stay in sync if the backend value is changed.

---

## 13. File and Module Structure

```
src/
├── background/
│   ├── index.ts                        # Existing entry point — onMessage handler
│   ├── chat-stream.ts                  # handleChatStreamPort(), streamChatRequest()  [NEW]
│   ├── session.ts                      # CREATE_CHAT_SESSION handler, parseErrorResponse()  [NEW]
│   └── sse-parser.ts                   # extractSSEEvents(), unescapeSSENewlines()  [NEW]
├── panel/
│   ├── main.tsx                        # Existing React entry
│   ├── SidePanel.tsx                   # Existing root — add <ChatPanel> below <AnalysisView>
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatPanel.tsx           [NEW]
│   │   │   ├── ChatHeader.tsx          [NEW]
│   │   │   ├── ChatMessageList.tsx     [NEW]
│   │   │   ├── UserMessage.tsx         [NEW]
│   │   │   ├── AssistantMessage.tsx    [NEW]
│   │   │   ├── StreamingMessage.tsx    [NEW]
│   │   │   ├── DefaultActions.tsx      [NEW]
│   │   │   └── ChatInputBar.tsx        [NEW]
│   │   └── (existing components)
│   └── hooks/
│       ├── useChatStore.ts             [NEW]
│       └── (existing hooks)
├── types/
│   └── chat.ts                         # ChatMessage, ChatError, PortMessage types  [NEW]
├── constants.ts                        # API_BASE_URL, STORAGE_KEYS, etc.  [EXTENDED]
└── (existing files)

tests/
├── background/
│   ├── chat-stream.test.ts             [NEW]
│   └── sse-parser.test.ts              [NEW]
└── panel/
    ├── hooks/
    │   └── useChatStore.test.ts        [NEW]
    └── components/chat/
        ├── ChatPanel.test.tsx          [NEW]
        ├── ChatInputBar.test.tsx       [NEW]
        └── StreamingMessage.test.tsx   [NEW]
```

---

## 14. Test Requirements

Tests are written before implementation (TDD). Unit tests use `vitest` + `@testing-library/react`. Chrome extension APIs (`chrome.runtime`, `chrome.storage`) are mocked via `vitest-chrome` or manual mocks. No real network calls — `fetch` is mocked throughout.

### 14.1 Fixtures and mocks (`tests/setup.ts` or per-file)

```typescript
// Mock chrome.runtime.connect — returns a mock Port object
function makeMockPort(name: string): MockPort {
  // Has: postMessage(), disconnect(), onMessage.addListener(), onDisconnect.addListener()
  // Tracks all postMessage() calls in .messages[]
  // Can be triggered: port.simulateMessage(msg), port.simulateDisconnect()
}

// Mock chrome.storage.session
const mockStorage: Record<string, unknown> = {};
chrome.storage.session.get = vi.fn(async (keys) => /* returns subset of mockStorage */);
chrome.storage.session.set = vi.fn(async (items) => { Object.assign(mockStorage, items); });

// Mock fetch — returns configurable SSE stream
function makeMockSSEResponse(events: string[]): Response {
  // Returns a Response whose body is a ReadableStream that emits each event string
  // Events are formatted as "data: {token}\n\n", with "[DONE]" last
}
```

---

### 14.2 Unit — `sse-parser.ts`

**File**: `tests/background/sse-parser.test.ts`

```
test_extractSSEEvents_parses_single_complete_event
    Given: buffer = "data: hello\n\n"
    Then: parsed = [{type: "message", data: "hello"}]; remainder = ""

test_extractSSEEvents_parses_multiple_complete_events
    Given: buffer = "data: tok1\n\ndata: tok2\n\n"
    Then: parsed has 2 items; remainder = ""

test_extractSSEEvents_returns_incomplete_event_as_remainder
    Given: buffer = "data: tok1\n\ndata: tok2\n"   (second event incomplete — no closing \n\n)
    Then: parsed has 1 item (tok1); remainder = "data: tok2\n"

test_extractSSEEvents_parses_named_event_type
    Given: buffer = "event: error\ndata: {\"code\":\"rate_limit\"}\n\n"
    Then: parsed = [{type: "error", data: "{\"code\":\"rate_limit\"}"}]

test_extractSSEEvents_skips_empty_blocks
    Given: buffer = "\n\ndata: tok\n\n"
    Then: parsed has 1 item (tok)

test_extractSSEEvents_handles_empty_buffer
    Given: buffer = ""
    Then: parsed = []; remainder = ""

test_extractSSEEvents_preserves_remainder_across_calls
    Given: first call with partial buffer; second call with remainder + new data completing the event
    Then: second call returns the complete event

test_unescapeSSENewlines_replaces_escaped_newlines
    Given: token = "line1\\nline2"   (two chars: backslash + n)
    Then: returns "line1\nline2"     (one char: newline)

test_unescapeSSENewlines_does_not_affect_tokens_without_escape_sequence
    Given: token = "hello world"
    Then: returns "hello world" unchanged

test_unescapeSSENewlines_handles_multiple_escaped_newlines
    Given: token = "a\\nb\\nc"
    Then: returns "a\nb\nc"

test_unescapeSSENewlines_empty_string_returns_empty_string
```

---

### 14.3 Unit — `chat-stream.ts`

**File**: `tests/background/chat-stream.test.ts`

```
test_streamChatRequest_sends_tokens_via_port
    Given: fetch mock returns SSE stream: ["tok1", "tok2", "[DONE]"]
    When: streamChatRequest(port, payload) called
    Then: port.messages contains:
          [{type:"CHAT_TOKEN", token:"tok1"}, {type:"CHAT_TOKEN", token:"tok2"}, {type:"CHAT_DONE"}]

test_streamChatRequest_calls_port_disconnect_after_done
    Given: fetch returns ["tok", "[DONE]"]
    When: streamChatRequest completes
    Then: port.disconnect() was called exactly once

test_streamChatRequest_unescapes_newlines_before_forwarding
    Given: fetch returns SSE stream with token "line1\\nline2" (escaped)
    When: streamChatRequest forwards token
    Then: CHAT_TOKEN message has token = "line1\nline2" (real newline)

test_streamChatRequest_sends_chat_error_on_sse_error_event
    Given: fetch returns SSE stream with: event: error\ndata: {"code":"rate_limit","message":"..."}\n\n
    When: streamChatRequest processes stream
    Then: port.messages contains {type:"CHAT_ERROR", code:"rate_limit"}
          port.disconnect() called

test_streamChatRequest_sends_chat_error_on_http_404
    Given: fetch returns HTTP 404 with body {"detail": "session_not_found"}
    When: streamChatRequest runs
    Then: port.messages contains {type:"CHAT_ERROR", code:"session_not_found"}

test_streamChatRequest_sends_chat_error_on_http_429
    Given: fetch returns HTTP 429 with body {"detail": "turn_limit_exceeded", "max_turns": 20}
    When: streamChatRequest runs
    Then: port.messages contains {type:"CHAT_ERROR", code:"turn_limit_exceeded"}

test_streamChatRequest_sends_chat_error_on_network_failure
    Given: fetch throws TypeError (network error)
    When: streamChatRequest runs
    Then: port.messages contains {type:"CHAT_ERROR", code:"network_error"}

test_streamChatRequest_aborts_fetch_on_port_disconnect
    Given: fetch is a slow stream (never resolves); port.simulateDisconnect() called mid-stream
    When: streamChatRequest is running
    Then: fetch was called with an AbortSignal; the signal is aborted after simulateDisconnect()

test_streamChatRequest_handles_stream_ending_without_done_marker
    Given: fetch returns SSE stream: ["tok1"] then ReadableStream closes without [DONE]
    When: streamChatRequest processes stream
    Then: port.messages ends with {type:"CHAT_DONE"} (stream end treated as completion)

test_streamChatRequest_posts_to_correct_url
    Given: API_BASE_URL = "https://api.example.com"; session_id = "abc-123"
    When: streamChatRequest runs
    Then: fetch called with URL "https://api.example.com/chat/abc-123"

test_streamChatRequest_sends_correct_request_body
    Given: payload = { session_id: "s1", message: "Hi", history: [{role:"user",content:"A"}] }
    When: streamChatRequest runs
    Then: fetch body JSON parses to { message: "Hi", history: [{role:"user",content:"A"}] }
```

---

### 14.4 Unit — `useChatStore`

**File**: `tests/panel/hooks/useChatStore.test.ts`

Using `renderHook` from `@testing-library/react`.

```
test_initial_state_loaded_from_storage
    Given: storage has cv_chat_history=[{role:"user",content:"Hi"}], cv_turn_count=3
    When: useChatStore initialises
    Then: hook.history = [{role:"user",content:"Hi"}]; hook.turnCount = 3

test_initial_state_defaults_when_storage_empty
    Given: storage is empty
    When: useChatStore initialises
    Then: hook.history = []; hook.turnCount = 0; hook.isStreaming = false; hook.error = null

test_submit_adds_user_message_to_history_optimistically
    Given: hook initialised; no active stream
    When: hook.submitMessage("Hello")
    Then: hook.history contains {role:"user", content:"Hello"} immediately (before any port message)

test_submit_sets_isStreaming_true
    When: hook.submitMessage("Hello")
    Then: hook.isStreaming === true

test_submit_clears_inputValue
    Given: hook.inputValue = "Hello"
    When: hook.submitMessage("Hello")
    Then: hook.inputValue === ""

test_chat_token_appends_to_streamingContent
    Given: active stream; port sends {type:"CHAT_TOKEN", token:"foo"}
    Then: hook.streamingContent === "foo"

test_multiple_tokens_accumulate_in_streamingContent
    Given: port sends "Hello", " ", "world" sequentially
    Then: hook.streamingContent === "Hello world"

test_chat_done_moves_streaming_content_to_history
    Given: streamingContent = "Response text"; port sends CHAT_DONE
    Then: hook.history last item = {role:"assistant", content:"Response text"}
          hook.streamingContent = ""
          hook.isStreaming = false

test_chat_done_increments_turn_count
    Given: turnCount = 2; CHAT_DONE received
    Then: hook.turnCount = 3

test_chat_done_persists_history_and_turn_count_to_storage
    Given: CHAT_DONE received
    Then: chrome.storage.session.set called with cv_chat_history and cv_turn_count

test_chat_error_sets_error_state
    Given: port sends {type:"CHAT_ERROR", code:"network_error", message:"Failed"}
    Then: hook.error = {code:"network_error", message:"Failed", retryable:true}
          hook.isStreaming = false

test_port_disconnect_without_done_sets_connection_lost_error
    Given: isStreaming = true; port.simulateDisconnect() without prior CHAT_DONE
    Then: hook.error.code === "connection_lost"; hook.isStreaming = false

test_retry_removes_last_user_message_and_restores_input
    Given: error state; last history item is {role:"user", content:"What happened?"}
    When: hook.retry()
    Then: that user message removed from history; hook.inputValue = "What happened?"
          hook.error = null

test_video_change_resets_history_and_turn_count
    Given: history has 3 messages; turnCount = 5
    When: chrome.storage.onChanged fires with cv_video_id change
    Then: hook.history = []; hook.turnCount = 0

test_cannot_submit_while_streaming
    Given: isStreaming = true
    When: hook.submitMessage("Hi")
    Then: no Port opened; history unchanged

test_cannot_submit_when_turn_limit_reached
    Given: turnCount = 20; maxTurns = 20
    When: hook.submitMessage("Hi")
    Then: no Port opened
```

---

### 14.5 Component tests

**File**: `tests/panel/components/chat/ChatInputBar.test.tsx`

```
test_send_button_disabled_when_input_empty
test_send_button_disabled_when_isStreaming_true
test_send_button_disabled_when_turn_limit_reached
test_enter_key_submits_message
test_shift_enter_inserts_newline_not_submit
test_input_clears_after_submit
test_input_enforces_maxlength_4000
```

**File**: `tests/panel/components/chat/StreamingMessage.test.tsx`

```
test_renders_streaming_content
test_shows_blinking_cursor_while_streaming
test_does_not_show_cursor_when_not_streaming
test_does_not_rerender_sibling_components_on_token_append
    (Use React Profiler or render count assertion via React.memo)
```

**File**: `tests/panel/components/chat/ChatPanel.test.tsx`

```
test_renders_chat_panel_when_status_ready
test_does_not_render_chat_panel_when_status_idle
test_shows_insufficient_credits_message_when_session_error_is_insufficient_credits
test_shows_turn_limit_reached_when_at_max_turns
test_error_banner_shown_when_error_state_set
test_error_banner_dismissed_on_x_click
test_retry_button_shown_for_retryable_errors_only
test_message_list_auto_scrolls_on_new_token
test_default_actions_visible_when_history_empty
test_default_actions_hidden_while_streaming
```

---

*End of document.*
