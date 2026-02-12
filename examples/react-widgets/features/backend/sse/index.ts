import type { RuntimeYield, WithMetadata } from "@gumbee/agent"
import { encodeSSEEvent } from "@/features/backend/agent/sse"

type SSEOptions = {
  /** Runs after all stream events have been forwarded to the client. */
  onEnd?: () => void | Promise<void>
}

/**
 * Wraps an async runtime event stream into an SSE `Response`.
 *
 * Every `RuntimeYield` is forwarded as a server-sent event.
 * If the stream throws, an `agent-error` event is sent to the client instead.
 *
 * @example
 * ```ts
 * const { stream, memory } = agent.run(prompt, {})
 *
 * return sse(stream, {
 *   onEnd: async () => {
 *     const appended = await memory.appended()
 *     appendChatMessages(chatId, appended)
 *   },
 * })
 * ```
 */
export function sse(stream: AsyncIterable<WithMetadata<RuntimeYield>>, options?: SSEOptions): Response {
  const readable = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const writeEvent = (event: RuntimeYield) => controller.enqueue(encodeSSEEvent(event))

      try {
        for await (const event of stream) {
          if (event.path.at(-1) === "widget_schema") {
            // don't send any widget schema events to the client
          } else {
            writeEvent(event)
          }
        }
      } catch (error) {
        const fallbackError: RuntimeYield = {
          type: "agent-error",
          error: error instanceof Error ? error : new Error("Unknown streaming error"),
        }
        writeEvent(fallbackError)
      } finally {
        await options?.onEnd?.()

        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
