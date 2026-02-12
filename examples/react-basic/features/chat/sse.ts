/**
 * Minimal SSE parser used by the Zustand chat store.
 * Reads `data:` lines and yields parsed JSON payloads.
 */
export async function* parseSSE<T>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data:")) continue

        const data = line.slice(line.startsWith("data: ") ? 6 : 5)
        if (data === "[DONE]") continue

        try {
          yield JSON.parse(data) as T
        } catch (error) {
          console.error("Failed to parse SSE payload", error)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
