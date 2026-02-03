/**
 * Middleware interface for wrapping agent and tool execution.
 *
 * Middlewares can intercept and modify agent/tool execution, enabling:
 * - Retry/fallback logic
 * - Caching and replay
 * - Observability and logging
 * - Context modification
 *
 * Middlewares propagate via AsyncLocalStorage based on shouldDescendInto* methods.
 */

import type { AgentExecutionNode } from "./graph/types"
import type {
  Agent,
  AgentLoopContext,
  Ref,
  RunnerEnvironment,
  RuntimeYield,
  Tool,
  ToolYield,
} from "./types"

// =============================================================================
// Middleware Context Types
// =============================================================================

/**
 * Context provided to handleAgent.
 * Same as AgentLoopContext - contains all info needed to run an agent.
 */
export type AgentMiddlewareContext<Context = any> = AgentLoopContext<Context>

/**
 * Result returned by handleAgent.
 * Contains mutable refs to context/node and the event stream.
 */
export type AgentMiddlewareResult<Context = any> = {
  /** Mutable reference to the context (may be updated on retry) */
  context: Ref<AgentLoopContext<Context>>
  /** The event stream */
  stream: AsyncGenerator<RuntimeYield, void, unknown>
  /** Mutable reference to the agent execution node (may be updated on retry) */
  node: Ref<AgentExecutionNode>
}

/**
 * Context provided to handleTool.
 * Contains the tool being executed and all info needed to run it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolMiddlewareContext<Context = any, Input = unknown, Output = any, CustomYields = any> = {
  /** The tool being executed */
  tool: Tool<Context, Input, Output, CustomYields>
  /** The input to the tool */
  input: Input
  /** Application-level context */
  context: Context
  /** Runner environment (abort signal, toolCallId) */
  env: RunnerEnvironment
}

/**
 * Result returned by handleTool.
 * Contains mutable ref to input and the event stream that yields output.
 */
export type ToolMiddlewareResult<Output = unknown> = {
  /** Mutable reference to the input (may be modified on retry) */
  input: Ref<{ value: unknown }>
  /** The event stream that yields ToolYield events and returns output */
  stream: AsyncGenerator<ToolYield, Output, unknown>
}

// =============================================================================
// Middleware Interface
// =============================================================================

/**
 * Middleware interface for wrapping agent and tool execution.
 *
 * Implement this interface to create middleware. All methods are optional
 * with sensible defaults (pass-through for handlers, false for descent).
 *
 * @example
 * ```typescript
 * function logging(): Middleware {
 *   return {
 *     handleAgent(c, next) {
 *       console.log("Agent starting:", c.prompt)
 *       return next(c)
 *     },
 *     handleTool(c, next) {
 *       console.log("Tool starting:", c.tool.name)
 *       return next(c)
 *     },
 *     shouldDescendIntoAgent: () => true,
 *     shouldDescendIntoTool: () => true,
 *   }
 * }
 * ```
 */
export interface Middleware<Context = any> {
  /**
   * Wrap agent execution. Implement to modify context, transform stream,
   * implement retry logic, caching, or short-circuit execution.
   *
   * If not provided, passes through to next.
   */
  handleAgent?(
    c: AgentMiddlewareContext<Context>,
    next: (c: AgentMiddlewareContext<Context>) => AgentMiddlewareResult<Context>,
  ): AgentMiddlewareResult<Context>

  /**
   * Wrap tool execution. Implement to modify input, transform stream,
   * implement retry logic, or intercept output.
   *
   * If not provided, passes through to next.
   */
  handleTool?<Input, Output>(
    c: ToolMiddlewareContext<Context, Input>,
    next: (c: ToolMiddlewareContext<Context, Input>) => ToolMiddlewareResult<Output>,
  ): ToolMiddlewareResult<Output>

  /**
   * Whether this middleware should be applied to the given subagent.
   * Called when a parent agent invokes a subagent.
   *
   * If not provided, defaults to false (middleware stays on current agent only).
   */
  shouldDescendIntoAgent?(agent: Agent<Context>): boolean

  /**
   * Whether this middleware should be applied to the given tool.
   * Called when an agent invokes a tool.
   *
   * If not provided, defaults to false (middleware does not apply to tools).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shouldDescendIntoTool?(tool: Tool<Context, any, any, any>): boolean
}
