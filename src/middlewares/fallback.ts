/**
 * Retry middleware that falls back to a different model if the LLM call fails.
 *
 * This middleware only retries when the LLM call fails before any stream events
 * are produced (e.g., network errors, rate limits, API errors). Once streaming
 * has started, errors propagate normally without retry.
 */

import type { JSONValue, LanguageModel } from "ai"
import type { AgentExecutionNode } from "../runtime/graph/types"
import type { AgentMiddlewareContext, AgentMiddlewareResult, Middleware } from "../runtime/middleware"
import { type AgentLoopContext, createRef, type RuntimeYield } from "../runtime/types"

export type FallbackMiddlewareOptions = {
  /** Fallback model to use on failure */
  model: LanguageModel
  /** Provider-specific options for the fallback model (e.g. thinking budget for Claude) */
  providerOptions?: Record<string, Record<string, JSONValue>>
  /** Maximum retry attempts (default: 1) */
  maxRetries?: number
  /** Optional predicate to control which errors trigger retry */
  shouldRetry?: (error: Error, attempt: number) => boolean
}

/**
 * Creates a fallback middleware that retries with a different model on failure.
 *
 * The middleware attempts to get the first event from the stream. If an error
 * is thrown before any events are produced, it retries with the fallback model.
 * Once streaming has started successfully, errors propagate normally.
 *
 * @example
 * ```typescript
 * const { stream, node, context } = agent.run(prompt, context, {
 *   middleware: [
 *     fallback({
 *       model: anthropic("claude-sonnet-4-20250514"),
 *       providerOptions: {
 *         anthropic: { thinking: { type: "enabled", budgetTokens: 10000 } },
 *       },
 *       maxRetries: 2,
 *       shouldRetry: (error) => error.message.includes("rate limit"),
 *     })
 *   ]
 * })
 *
 * for await (const event of stream) {
 *   console.log(event)
 * }
 *
 * // After stream consumed, node and context reflect the successful attempt
 * console.log(context.model) // The model that succeeded
 * ```
 *
 * @example Chain multiple fallbacks for cascading model failover:
 * ```typescript
 * // If primary fails → try modelB → if that fails → try modelC
 * middleware: [
 *   fallback({ model: modelC }),
 *   fallback({ model: modelB }),
 * ]
 * ```
 */
export function fallback<Context = any>(options: FallbackMiddlewareOptions): Middleware<Context> {
  const { model, providerOptions, maxRetries = 1, shouldRetry: shouldRetryFn = () => true } = options

  return {
    handleAgent(
      c: AgentMiddlewareContext<Context>,
      next: (c: AgentMiddlewareContext<Context>) => AgentMiddlewareResult<Context>,
    ): AgentMiddlewareResult<Context> {
      // Mutable refs that we update on each attempt
      // Initialize with placeholder values - will be set during stream consumption
      const context = createRef<AgentLoopContext<Context>>(c)
      const node = createRef<AgentExecutionNode>(null as unknown as AgentExecutionNode)

      // Create a stream that handles retry logic
      const stream = (async function* (): AsyncGenerator<RuntimeYield, void, unknown> {
        let attempt = 0

        while (attempt <= maxRetries) {
          // Swap to fallback model (and optionally provider options) on retry attempts
          const ctx = attempt > 0 ? { ...c, model, ...(providerOptions && { providerOptions }) } : c

          // Get result from next middleware/base
          const result = next(ctx)

          // Update refs to point to this attempt's values
          context.set(result.context.current)
          node.set(result.node.current)

          try {
            // Try to get the first event - this is where LLM call errors surface
            const firstEvent = await result.stream.next()

            if (firstEvent.done) {
              // Stream completed without yielding anything
              return
            }

            // First event received successfully - yield it and continue streaming
            yield firstEvent.value

            // Continue yielding remaining events (no retry from here)
            for await (const event of result.stream) {
              yield event
            }

            // Stream completed successfully
            return
          } catch (error) {
            // Error before first event - check if we should retry
            const err = error instanceof Error ? error : new Error(String(error))

            if (attempt < maxRetries && shouldRetryFn(err, attempt + 1)) {
              // Retry with fallback model
              attempt++
              continue
            }

            // No more retries - rethrow
            throw error
          }
        }
      })()

      return { context, stream, node }
    },

    // Default: don't descend into subagents or tools
    // Fallback should only apply to the agent it's configured on
  }
}
