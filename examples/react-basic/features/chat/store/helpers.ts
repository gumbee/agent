import type { UiAssistantMessage } from "@/features/chat/types"

/**
 * Appends streamed assistant text into the current assistant message.
 */
export function appendAssistantText(message: UiAssistantMessage, textDelta: string) {
  const last = message.parts.at(-1)
  if (last?.type === "text") {
    last.text += textDelta
    return
  }

  message.parts.push({ type: "text", text: textDelta })
}
