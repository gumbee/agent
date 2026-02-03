/**
 * Utilities for merging async streams with event queues.
 *
 * This module provides utilities to properly interleave events from
 * tool execution with the main LLM stream during agentic loop processing.
 */

// =============================================================================
// Async Event Queue
// =============================================================================

/**
 * Async event queue that supports synchronous pushes and async consumption.
 *
 * Events can be pushed synchronously (e.g., from callbacks), but consumers
 * can await new events. This enables true concurrent merging where the
 * consumer yields events as soon as they're pushed, without waiting for
 * the primary stream.
 */
export type AsyncEventQueue<T> = {
  /** Push an event to the queue (synchronous) */
  push: (event: T) => void
  /** Signal that no more events will be pushed */
  close: () => void
  /** Check if the queue is closed */
  readonly closed: boolean
  /** Get current queue length (for debugging) */
  readonly length: number
  /** Async iterator for consuming events */
  [Symbol.asyncIterator](): AsyncIterableIterator<T>
}

/**
 * Creates an async event queue for collecting events during async processing.
 *
 * The queue supports:
 * - Synchronous `push()` calls (safe from callbacks)
 * - Async iteration that waits for new events
 * - `close()` to signal completion
 *
 * @example
 * ```typescript
 * const queue = createAsyncEventQueue<MyEvent>()
 *
 * // Push events synchronously (e.g., from tool execution callbacks)
 * queue.push({ type: "tool-progress", data: "..." })
 *
 * // Consume asynchronously (will wait for events)
 * for await (const event of queue) {
 *   console.log(event)
 * }
 *
 * // Signal no more events
 * queue.close()
 * ```
 */
export function createAsyncEventQueue<T>(): AsyncEventQueue<T> {
  const buffer: T[] = []
  let closed = false
  let waitingResolve: ((result: IteratorResult<T>) => void) | null = null

  return {
    push: (event: T) => {
      if (closed) return

      if (waitingResolve) {
        // A consumer is waiting - resolve immediately
        const resolve = waitingResolve
        waitingResolve = null
        resolve({ value: event, done: false })
      } else {
        // No consumer waiting - buffer the event
        buffer.push(event)
      }
    },

    close: () => {
      if (closed) return
      closed = true

      if (waitingResolve) {
        // A consumer is waiting - signal done
        const resolve = waitingResolve
        waitingResolve = null
        resolve({ value: undefined as T, done: true })
      }
    },

    get closed() {
      return closed
    },

    get length() {
      return buffer.length
    },

    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      const self = this
      return {
        async next(): Promise<IteratorResult<T>> {
          // Return buffered items first
          if (buffer.length > 0) {
            return { value: buffer.shift()!, done: false }
          }

          // If closed and buffer is empty, we're done
          if (closed) {
            return { value: undefined as T, done: true }
          }

          // Wait for next push or close
          return new Promise((resolve) => {
            waitingResolve = resolve
          })
        },
        [Symbol.asyncIterator]() {
          return self[Symbol.asyncIterator]()
        },
      }
    },
  }
}

// =============================================================================
// Async Iterable Merging
// =============================================================================

/**
 * Merges multiple async iterables, yielding items as they become available.
 *
 * Uses Promise.race internally to yield from whichever source has data ready.
 * This enables true concurrent consumption where events from any source are
 * yielded immediately without waiting for other sources.
 *
 * @param iterables - The async iterables to merge
 * @yields Items from any of the input iterables, in the order they become available
 *
 * @example
 * ```typescript
 * const stream1 = someAsyncGenerator()
 * const stream2 = anotherAsyncGenerator()
 *
 * for await (const item of mergeAsyncIterables(stream1, stream2)) {
 *   // Items from either stream, yielded as soon as available
 * }
 * ```
 */
export async function* mergeAsyncIterables<T extends unknown[]>(
  ...iterables: { [K in keyof T]: AsyncIterable<T[K]> }
): AsyncGenerator<T[number], void, unknown> {
  type ItemType = T[number]
  if (iterables.length === 0) return

  // Get iterators from all iterables
  const iterators = iterables.map((it) => (it as AsyncIterable<ItemType>)[Symbol.asyncIterator]())

  // Track pending promises for each iterator
  type PendingResult = { index: number; result: IteratorResult<ItemType> }
  const pending = new Map<number, Promise<PendingResult>>()

  // Start fetching from all iterators
  for (let i = 0; i < iterators.length; i++) {
    const iterator = iterators[i]!
    pending.set(
      i,
      iterator.next().then((result) => ({ index: i, result })),
    )
  }

  // Keep racing until all iterators are done
  while (pending.size > 0) {
    // Race all pending promises
    const { index, result } = await Promise.race(pending.values())

    if (result.done) {
      // This iterator is exhausted, remove it
      pending.delete(index)
    } else {
      // Yield the value
      yield result.value

      // Request next from this iterator
      const iterator = iterators[index]!
      pending.set(
        index,
        iterator.next().then((result) => ({ index, result })),
      )
    }
  }
}

// =============================================================================
// Stream + Queue Merging (with automatic cleanup)
// =============================================================================

/**
 * Merges a primary async stream with an async event queue, automatically
 * closing the queue when the primary stream completes.
 *
 * This is the recommended way to merge an LLM stream with tool events:
 * - Events from both sources are yielded as soon as they're available
 * - The queue is automatically closed when the primary stream finishes
 * - Handles errors gracefully (closes queue in finally block)
 *
 * @param stream - The primary async stream (e.g., LLM response stream)
 * @param queue - The async event queue (receives events from tool execution)
 * @yields Items from either source, in the order they become available
 *
 * @example
 * ```typescript
 * const queue = createAsyncEventQueue<ToolEvent>()
 *
 * // Tool execution pushes to queue
 * const tools = convertRunnersForAI(runners, context, env, (event) => {
 *   queue.push(event)
 * })
 *
 * // Merge stream with queue - queue is closed automatically when stream ends
 * for await (const item of mergeStreamWithQueue(llmStream, queue)) {
 *   if (isToolEvent(item)) {
 *     // Handle tool event
 *   } else {
 *     // Handle stream part
 *   }
 * }
 * ```
 */
export async function* mergeStreamWithQueue<S, Q>(
  stream: AsyncIterable<S>,
  queue: AsyncEventQueue<Q>,
): AsyncGenerator<S | Q, void, unknown> {
  // Wrap stream to close queue when done
  async function* streamWithCleanup(): AsyncGenerator<S, void, unknown> {
    try {
      yield* stream
    } finally {
      // Close the queue when stream is done - ensures the merge completes
      queue.close()
    }
  }

  // Merge the wrapped stream with the queue
  yield* mergeAsyncIterables(streamWithCleanup(), queue)
}
