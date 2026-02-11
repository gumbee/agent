/**
 * Retry middleware that falls back to a different model if an LLM step fails.
 *
 * This middleware operates at the step level (handleAgentStep), allowing recovery
 * from individual failing LLM calls without restarting the entire agent loop.
 * It only retries when the LLM call fails before any content has been produced
 * (text-delta or reasoning events). Once actual content starts streaming,
 * errors propagate normally without retry to avoid inconsistent output.
 */

import type { JSONValue, LanguageModel } from "ai"
import type { AgentStepMiddlewareContext, AgentStepMiddlewareResult, Middleware } from "../runtime/middleware"
import type { AgentStepRetryYield, AgentStreamYield } from "../runtime/types"

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
 * Creates a fallback middleware that retries individual LLM steps with a different model on failure.
 *
 * The middleware intercepts each step in the agent loop. When a step fails before producing
 * any content (text-delta or reasoning events), it retries that specific step with the fallback
 * model. Once content starts streaming, errors propagate without retry. This allows graceful
 * recovery from transient failures without producing inconsistent output.
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
 * // After stream consumed, node and context are available as promises
 * const nodeResult = await node
 * const contextResult = await context
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
export function fallback<Context = any>(options: FallbackMiddlewareOptions): Middleware<Context, AgentStepRetryYield> {
  const { model, providerOptions, maxRetries = 1, shouldRetry: shouldRetryFn = () => true } = options

  return {
    async *handleAgentStep(
      c: AgentStepMiddlewareContext<Context>,
      next: (c: AgentStepMiddlewareContext<Context>) => AgentStepMiddlewareResult<AgentStepRetryYield>,
    ): AgentStepMiddlewareResult<AgentStepRetryYield> {
      let attempt = 0

      while (attempt <= maxRetries) {
        // Swap to fallback model (and optionally provider options) on retry attempts
        const ctx = attempt > 0 ? { ...c, model, ...(providerOptions && { providerOptions }) } : c

        // Track whether content has been produced (text-delta or reasoning-delta)
        let hasProducedContent = false

        try {
          const stream = next(ctx)

          // Manually iterate to capture return value (for await...of discards it)
          let result = await stream.next()
          while (!result.done) {
            const event = result.value

            // Check if this event contains actual content
            if (event.type === "agent-stream") {
              const part = (event as AgentStreamYield).part

              if (part.type === "text-delta" || part.type === "reasoning-delta") {
                hasProducedContent = true
              }
            }

            yield event
            result = await stream.next()
          }

          // Stream completed successfully - return the finish reason
          return result.value
        } catch (error) {
          // Only retry if no content has been produced yet
          if (hasProducedContent) {
            throw error
          }

          const err = error instanceof Error ? error : new Error(String(error))

          if (attempt < maxRetries && shouldRetryFn(err, attempt + 1)) {
            const toModelId = typeof model === "object" && "modelId" in model ? String(model.modelId) : String(model)
            const toProvider = typeof model === "object" && "provider" in model ? String(model.provider) : "unknown"

            yield {
              type: "agent-step-retry",
              step: c.step,
              attempt: attempt + 1,
              error: err.message,
              toModelId,
              toProvider,
            }

            // Retry with fallback model
            attempt++
            continue
          }

          // No more retries - rethrow
          throw error
        }
      }

      // This should never be reached, but TypeScript needs it
      throw new Error("Fallback middleware exhausted all retries")
    },

    // Default: don't descend into subagents or tools
    // Fallback should only apply to the agent it's configured on
  }
}
