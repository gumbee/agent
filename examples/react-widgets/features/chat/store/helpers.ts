import type { UiAssistantMessage } from "@/features/chat/types"
import type { UiChatWidget } from "@/features/widgets"

/**
 * Applies a widget delta into the current assistant message.
 * If the latest part is already a `widgets` array, it updates the entry at the
 * correct local index (event index minus the stored base). Otherwise a fresh
 * `widgets` part is created with the incoming index as base so the first entry
 * always lands at position 0.
 */
export function applyWidgetDelta(target: UiAssistantMessage, index: number, widget: UiChatWidget) {
  const lastPart = target.parts.at(-1)

  if (lastPart?.type === "widgets") {
    const localIndex = index - lastPart.baseIndex
    lastPart.widgets[localIndex] = widget
    return
  }

  target.parts.push({ type: "widgets", baseIndex: index, widgets: [widget] })
}
