import type { RuntimeYield, WithMetadata } from "@gumbee/agent"
import { parseSSE } from "@/features/chat/sse"
import { applyWidgetDelta } from "@/features/chat/store/helpers"
import type { ChatStoreContext } from "@/features/chat/store/types"
import type { ToolCallPart, UiAssistantMessage, UiMessage } from "@/features/chat/types"
import type { UiChatWidget } from "@/features/widgets"

/**
 * Sends a prompt to the backend and incrementally applies streamed agent events.
 * This is purely Zustand state-driven.
 */
export function sendMessageAction({ set, get }: ChatStoreContext) {
  return async (prompt: string): Promise<void> => {
    if (!prompt.trim() || get().streaming) return

    let chatId = get().chatId

    if (!chatId) chatId = await get().createChat()
    if (!chatId) return

    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    }

    const assistantMessage: UiAssistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [],
      streaming: true,
    }

    // append the user and assistant messages to the chat
    set((state) => ({
      streaming: true,
      messages: [...state.messages, userMessage, assistantMessage],
    }))

    try {
      // send the user message to the backend
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok || !response.body) {
        throw new Error("Failed to stream response")
      }

      for await (const event of parseSSE<WithMetadata<RuntimeYield>>(response.body)) {
        set((state) => {
          const messages = [...state.messages]

          // get the target assistant message to edit with the backend response
          const target = messages.find((message): message is UiAssistantMessage => message.id === assistantMessage.id)

          if (!target) return state

          // only show output from the root agent
          const isRootAgent = event.path.length <= 1

          if (event.type === "widget-delta" && isRootAgent) {
            applyWidgetDelta(target, event.index, event.widget as UiChatWidget)
          } else if (event.type === "agent-begin" && !isRootAgent) {
            target.parts.push({
              type: "tool-call",
              toolCallId: event.nodeId,
              name: event.name,
              input: event.input,
              status: "running",
            })
          } else if (event.type === "tool-begin") {
            // display tool calls as parts
            target.parts.push({
              type: "tool-call",
              toolCallId: event.toolCallId,
              name: event.tool,
              input: event.input,
              status: "running",
            })
          } else if (event.type === "tool-end") {
            // update the tool call status and output on completion
            const toolPart = target.parts.find((part): part is ToolCallPart => part.type === "tool-call" && part.toolCallId === event.toolCallId)

            if (toolPart) {
              toolPart.status = "completed"
              toolPart.output = event.output
            }
          } else if (event.type === "tool-error") {
            // update the tool call status and output on error
            const toolPart = target.parts.find((part): part is ToolCallPart => part.type === "tool-call" && part.toolCallId === event.toolCallId)

            if (toolPart) {
              toolPart.status = "error"
              toolPart.output = event.error
            }
          } else if (event.type === "agent-end" && !isRootAgent) {
            const toolPart = target.parts.find((part): part is ToolCallPart => part.type === "tool-call" && part.toolCallId === event.nodeId)

            if (toolPart) {
              toolPart.status = "completed"
              toolPart.output = null
            }
          } else if (event.type === "agent-end" && isRootAgent) {
            target.streaming = false
          }

          return { messages }
        })
      }
    } catch {
      // if we encounter an unexpected error, just terminate streaming state for the assistant message
      set((state) => {
        const target = state.messages.find((message): message is UiAssistantMessage => message.id === assistantMessage.id)

        if (!target) return state

        target.streaming = false

        return state
      })
    } finally {
      // end stream
      set({ streaming: false })
    }
  }
}
