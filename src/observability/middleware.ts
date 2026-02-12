import type { Middleware } from "../index"
import type { AddEventsPayload, CreateTracePayload, StoredEvent } from "./types"

export interface ObservabilityOptions {
  /** URL of the observability dashboard server (default: "http://localhost:4500") */
  apiUrl?: string
  enabled?: boolean
  /**
   * Hook to extend the lifetime of a request beyond the response.
   * Pass `ctx.waitUntil` from Cloudflare Workers (or similar) to
   * keep the worker alive until all event batches have been sent.
   *
   * When provided, in-flight requests are handed off via this function
   * instead of being awaited at the end of the stream.
   *
   * @example Cloudflare Workers
   * ```ts
   * export default {
   *   async fetch(request: Request, env: Env, ctx: ExecutionContext) {
   *     const middleware = observability({
   *       apiUrl: "https://dashboard.example.com",
   *       waitUntil: ctx.waitUntil.bind(ctx),
   *     })
   *     // ...
   *   },
   * }
   * ```
   */
  waitUntil?: (promise: Promise<unknown>) => void
  /** Flush interval in milliseconds (default: 150) */
  flushIntervalMs?: number
}

export function observability<Context = any>(options?: ObservabilityOptions): Middleware<Context, never> {
  // Normalize URL (remove trailing slash)
  const baseUrl = (options?.apiUrl ?? "http://localhost:4500").replace(/\/$/, "")
  const flushIntervalMs = options?.flushIntervalMs ?? 150
  const waitUntil = options?.waitUntil

  function sendEvents(traceId: string, events: StoredEvent[]): Promise<void> {
    const payload = JSON.stringify({ traceId, events } satisfies AddEventsPayload)

    const postBatch = () =>
      fetch(`${baseUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} from /api/events`)
      })

    return postBatch().catch((firstError) =>
      new Promise<void>((resolve) => setTimeout(resolve, 500)).then(postBatch).catch((retryError) => {
        console.error("[Observability] Failed to send events:", { firstError, retryError })
      }),
    )
  }

  function registerTrace(traceId: string, name: string): Promise<void> {
    return fetch(`${baseUrl}/api/traces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: traceId,
        name,
        startTime: Date.now(),
        tags: [],
        metadata: {},
      } satisfies CreateTracePayload),
    })
      .then(() => {})
      .catch((err) => {
        console.error("[Observability] Failed to register trace:", err)
      })
  }

  function track(promise: Promise<void>, inFlight: Promise<void>[]) {
    if (waitUntil) {
      waitUntil(promise)
    } else {
      inFlight.push(promise)
    }
  }

  return {
    async *handleAgent(c, next) {
      if (options?.enabled === false) {
        return yield* next(c)
      }

      const traceId = c.env.runId
      let buffer: StoredEvent[] = []
      let eventIndex = 0
      let flushTimer: ReturnType<typeof setTimeout> | null = null
      const inFlight: Promise<void>[] = []

      // Register the trace immediately
      track(registerTrace(traceId, "trace"), inFlight)

      function flush() {
        if (buffer.length > 0) {
          track(sendEvents(traceId, buffer), inFlight)
          buffer = []
        }
        flushTimer = null
      }

      function scheduleFlush() {
        if (!flushTimer) {
          flushTimer = setTimeout(flush, flushIntervalMs)
        }
      }

      const stream = next(c)

      let result: IteratorResult<any, any> | undefined
      try {
        while (!(result = await stream.next()).done) {
          const event = result.value

          // Buffer events with a monotonic index for deterministic ordering.
          // Keep ts for timing display and duration analysis in the dashboard.
          buffer.push({ index: eventIndex++, ts: performance.now(), data: event })

          scheduleFlush()

          yield event
        }
      } finally {
        // Always flush remaining events, even when the stream throws or is closed early.
        if (flushTimer) clearTimeout(flushTimer)

        flush()

        // Ensure non-waitUntil environments don't exit before pending requests complete.
        if (inFlight.length > 0) {
          await Promise.all(inFlight)
        }
      }

      return result!.value
    },
  }
}
