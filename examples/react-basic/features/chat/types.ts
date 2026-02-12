/**
 * Display-friendly text content rendered in the chat thread.
 */
export type TextPart = {
  type: "text"
  text: string
}

/**
 * Tool execution state surfaced in the UI while the assistant responds.
 */
export type ToolCallPart = {
  type: "tool-call"
  toolCallId: string
  name: string
  input?: unknown
  output?: unknown
  status: "running" | "completed" | "error"
}

export type ContentPart = TextPart | ToolCallPart

type UiBaseMessage = {
  id: string
}

/**
 * Explicit UI-level user message type.
 */
export type UiUserMessage = UiBaseMessage & {
  role: "user"
  content: string
}

/**
 * Explicit UI-level assistant message type.
 */
export type UiAssistantMessage = UiBaseMessage & {
  role: "assistant"
  parts: ContentPart[]
  streaming?: boolean
}

/**
 * Union used by the chat renderer/store.
 */
export type UiMessage = UiUserMessage | UiAssistantMessage
