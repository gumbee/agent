/**
 * Tool factory function and utilities for converting runners to AI SDK format.
 */

import { tool as aiTool, type ToolResultPart, type ToolSet } from "ai"
import { z } from "@gumbee/structured"
import { getCurrentNode, getMiddlewares, getPath } from "./graph/context"
import { createToolNode } from "./graph/node"
import type { ToolMiddlewareContext, ToolMiddlewareResult } from "./middleware"
import { type RuntimeYield, type Runner, type RunnerEnvironment, type Tool, type ToolConfig, type ToolYield } from "./types"

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a value is an async generator (has .next method).
 */
function isAsyncGenerator<T, R>(value: AsyncGenerator<T, R> | Promise<R>): value is AsyncGenerator<T, R> {
  return typeof value === "object" && value !== null && "next" in value && typeof (value as any).next === "function"
}

// =============================================================================
// Tool Factory
// =============================================================================

/**
 * Creates a tool with the given configuration.
 * Tools are units of work that can be called by agents.
 *
 * @example
 * ```typescript
 * const readFile = tool({
 *   name: "read_file",
 *   description: "Read a file from disk",
 *   input: z.object({ path: z.string() }),
 *   execute: async function* ({ path }, context) {
 *     const content = await fs.readFile(path, "utf-8")
 *     return { content }
 *   }
 * })
 * ```
 */
export const tool = <Context = {}, TSchema extends z.ZodSchema = z.ZodSchema<any>, Output = any, CustomYields = never>(
  config: Omit<ToolConfig<Context, z.infer<TSchema>, Output, CustomYields>, "input"> & { input: TSchema },
): Tool<Context, z.infer<TSchema>, Output, CustomYields> => {
  type Input = z.infer<TSchema>

  const thisTool: Tool<Context, Input, Output, CustomYields> = {
    __runner__: true,
    name: config.name,
    description: config.description,
    instructions: config.instructions,
    input: config.input as z.ZodSchema<Input>,

    execute: async function* (input: Input, context: Context, env: RunnerEnvironment): AsyncGenerator<ToolYield | CustomYields, Output> {
      // Get middlewares from current context that want to handle this tool
      const middlewares = getMiddlewares<Context>().filter((m) => m.shouldDescendIntoTool?.(thisTool) ?? false)

      // Base execution function as async generator
      async function* base(ctx: ToolMiddlewareContext<Context, Input>): ToolMiddlewareResult<Output> {
        // Get parent node from context and create ToolExecutionNode
        const parent = getCurrentNode() ?? null
        const node = createToolNode(config.name, ctx.input, parent)
        const path = getPath(node)

        node.setStatus("running")

        const toolCallId = node.id

        yield node.addEvent({ type: "tool-begin", path, tool: config.name, toolCallId, input: ctx.input })

        try {
          // Execute the tool - handle both async generators and plain async functions
          const executionResult = config.execute(ctx.input, ctx.context, { abort: ctx.env.abort, toolCallId })
          let result: Output

          // Check if it's an async generator (has .next method) or a promise
          if (isAsyncGenerator(executionResult)) {
            // It's an async generator - iterate and forward yielded events
            while (true) {
              const iterResult = await executionResult.next()

              if (iterResult.done) {
                result = iterResult.value
                break
              }

              // Yield custom events from the tool's execute function
              yield node.addEvent({
                type: "tool-progress",
                path,
                tool: config.name,
                toolCallId,
                event: iterResult.value,
              })
            }
          } else {
            // It's a promise - just await the result
            result = await executionResult
          }

          node.setOutput(result)
          node.setStatus("completed")

          yield node.addEvent({ type: "tool-end", path, tool: config.name, toolCallId, output: result })

          return result
        } catch (error) {
          console.error(`[tool:${config.name}] Error:`, error)
          yield node.addEvent({ type: "tool-error", path, tool: config.name, toolCallId, error: error as Error })

          node.setError(error as Error)
          node.setStatus("failed")
          throw error
        }
      }

      // Compose middleware using handleTool (reduceRight so first middleware wraps outermost)
      const wrappedExecute = middlewares.reduceRight<typeof base>(
        (next, mw) => (c) => (mw.handleTool ? (mw.handleTool(c, next) as ToolMiddlewareResult<Output>) : next(c)),
        base,
      )

      // Execute with middleware
      const middlewareContext: ToolMiddlewareContext<Context, Input, Output, CustomYields> = {
        tool: thisTool,
        input,
        context,
        env,
      }

      // Yield all events from the stream and return the final output
      return yield* wrappedExecute(middlewareContext)
    },
  }

  return thisTool
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a runner is a Tool (has an 'input' schema) vs an Agent.
 */
export function isTool(runner: Runner): runner is Tool {
  return "input" in runner && (runner as Tool).input !== undefined
}

// =============================================================================
// AI SDK Conversion Utilities
// =============================================================================

/**
 * Formats tool output for the AI SDK response format.
 */
export function formatToolOutput(output: unknown): ToolResultPart["output"] {
  if (typeof output === "string") {
    return { type: "text", value: output } as ToolResultPart["output"]
  }
  return { type: "json", value: output } as ToolResultPart["output"]
}

// Input schema for sub-agents (agents always accept a string prompt, wrapped in an object)
const AGENT_INPUT_SCHEMA = z
  .object({ prompt: z.string().describe("The prompt/instruction to pass to the sub-agent") })
  .describe("The input to pass to the sub-agent")

/**
 * Converts an array of runners (Tools or Agents) to AI SDK tool format.
 *
 * This is the key function that enables hierarchical agents:
 * - Tools use their own input schema and description
 * - Agents use AGENT_INPUT_SCHEMA and their `instructions` field as the description
 *
 * Events yielded during execution are passed to onYield for observability.
 */
export function convertRunnersForAI<Context>(
  runners: Runner<Context>[],
  context: Context,
  env: RunnerEnvironment,
  onYield: (event: RuntimeYield) => void,
): ToolSet {
  return Object.fromEntries(
    runners.map((runner) => {
      const isToolRunner = isTool(runner)

      return [
        runner.name,
        aiTool<any, any>({
          // Agents use `instructions` for LLM guidance on when to use them
          description: isToolRunner ? runner.description : (runner.instructions ?? runner.description),
          // Agents always receive { prompt: string }, tools use their own schema
          inputSchema: isToolRunner ? runner.input : AGENT_INPUT_SCHEMA,
          execute: async (input: any) => {
            // For agents, extract the prompt string from the wrapped input
            const gen = runner.execute(isToolRunner ? input : input.prompt, context, env)
            let result: IteratorResult<RuntimeYield, unknown>

            while (!(result = await gen.next()).done) {
              onYield(result.value)
            }

            return result.value
          },
        }),
      ]
    }),
  )
}
