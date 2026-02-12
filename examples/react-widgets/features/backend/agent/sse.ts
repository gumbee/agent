import type { RuntimeYield } from "@gumbee/agent"

/**
 * Encodes a runtime event into SSE wire format.
 */
export function encodeSSEEvent(event: RuntimeYield, encoder = new TextEncoder()): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
}
