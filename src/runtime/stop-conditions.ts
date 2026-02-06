import type { StopCondition, StopConditionInfo } from "./types"

/**
 * Stop after a fixed number of steps, regardless of finish reason.
 *
 * @example
 * ```typescript
 * new MyAgent({
 *   stopCondition: stopAfterSteps(3)
 * })
 * ```
 */
export function stopAfterSteps(maxSteps: number): StopCondition {
  return ({ step }: StopConditionInfo) => step >= maxSteps - 1
}

/**
 * Stop when the model finishes (i.e., doesn't request tool calls).
 * The agent will continue looping only while the model wants to use tools.
 *
 * @example
 * ```typescript
 * new MyAgent({
 *   stopCondition: stopOnFinish()
 * })
 * ```
 */
export function stopOnFinish(): StopCondition {
  return ({ finishReason }: StopConditionInfo) => finishReason !== "tool-calls"
}

/**
 * Default stop condition: stops after 30 steps OR when the model finishes.
 * This is the default behavior if no stopCondition is provided.
 * Equivalent to stopAny(stopAfterSteps(30), stopOnFinish())
 */
export const DEFAULT_STOP_CONDITION: StopCondition = stopAny(stopAfterSteps(30), stopOnFinish())

/**
 * Combine multiple stop conditions. Stops if ANY condition returns true.
 *
 * @example
 * ```typescript
 * new MyAgent({
 *   stopCondition: stopAny(
 *     stopAfterSteps(10),
 *     stopOnFinish(),
 *     ({ messages }) => messages.length > 50
 *   )
 * })
 * ```
 */
export function stopAny(...conditions: StopCondition[]): StopCondition {
  return (info: StopConditionInfo) => conditions.some((cond) => cond(info))
}

/**
 * Combine multiple stop conditions. Stops only if ALL conditions return true.
 *
 * @example
 * ```typescript
 * new MyAgent({
 *   stopCondition: stopAll(
 *     stopOnFinish(),
 *     ({ step }) => step >= 1  // Only stop if finished AND at least 2 steps
 *   )
 * })
 * ```
 */
export function stopAll(...conditions: StopCondition[]): StopCondition {
  return (info: StopConditionInfo) => conditions.every((cond) => cond(info))
}

/**
 * Stop when a specific tool has been called.
 *
 * @param toolName - Name of the tool to watch for
 *
 * @example
 * ```typescript
 * new MyAgent({
 *   stopCondition: stopOnToolCall('submit_answer')
 * })
 * ```
 */
export function stopOnToolCall(toolName: string): StopCondition {
  return ({ messages }: StopConditionInfo) => {
    // Check if any assistant message contains a tool call with the specified name
    return messages.some((msg) => {
      if (msg.role !== "assistant" || typeof msg.content === "string") return false
      // Cast content to array of parts to check for tool-call
      const parts = msg.content as Array<any>
      return parts.some((part) => part.type === "tool-call" && part.toolName === toolName)
    })
  }
}
