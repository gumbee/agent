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

import type { DescribeRegistry } from "@gumbee/structured"
import type { JSONValue, LanguageModel } from "ai"
import type { Memory } from "../memory"
import type {
  Agent,
  AgentLoopContext,
  FinishReason,
  Runner,
  RunnerEnvironment,
  RuntimeYield,
  SystemPrompt,
  Tool,
  ToolYield,
  WithMetadata,
} from "./types"

// =============================================================================
// Middleware Context Types
// =============================================================================

/**
 * Context provided to handleAgent.
 * Based on AgentLoopContext with env marked as readonly.
 */
export type AgentMiddlewareContext<Context = any> = Omit<AgentLoopContext<Context>, "env"> & {
  /** Runner environment (readonly - abort signal, toolCallId) */
  readonly env: RunnerEnvironment
}

/**
 * Result returned by handleAgent.
 * An async generator that yields events and returns the final context.
 */
export type AgentMiddlewareResult<Context = any, Custom extends { type: string } = never> = AsyncGenerator<
  RuntimeYield<Custom>,
  { context: AgentLoopContext<Context> },
  void
>

/**
 * Context provided to handleTool.
 * Contains the tool being executed and all info needed to run it.
 * Note: tool and env are readonly - not modifiable by middleware.
 */
export type ToolMiddlewareContext<Context = any, Input = unknown, Output = any, CustomYields = any> = {
  /** The tool being executed (readonly) */
  readonly tool: Tool<Context, Input, Output, CustomYields>
  /** Runner environment (readonly - abort signal, toolCallId) */
  readonly env: RunnerEnvironment
  /** The input to the tool */
  input: Input
  /** Application-level context */
  context: Context
}

/**
 * Result returned by handleTool.
 * An async generator that yields events (with metadata) and returns the output.
 * Generic `Custom` parameter allows middleware to yield additional custom event types.
 */
export type ToolMiddlewareResult<Output = unknown, Custom extends { type: string } = never> = AsyncGenerator<WithMetadata<ToolYield> | Custom, Output>

/**
 * Context provided to handleAgentStep.
 * Contains all info needed to execute a single LLM step within an agent loop.
 * Note: step and path are readonly - managed by the loop, not modifiable by middleware.
 */
export type AgentStepMiddlewareContext<Context = any> = {
  /** Current step number (1-indexed, readonly) */
  readonly step: number
  /** Node ID of the agent running this step (readonly) */
  readonly nodeId: string
  /** Execution path for event attribution (readonly) */
  readonly path: string[]
  /** Runner environment (readonly - abort signal, toolCallId) */
  readonly env: RunnerEnvironment
  /** The original input/prompt that triggered this agent */
  readonly input: unknown
  /** System prompt for this step (includes base tool instructions, resolved in executeStep) */
  system: SystemPrompt<Context>
  /** The model to use for this step */
  model: LanguageModel
  /** Available tools/runners for this step */
  tools: Runner<Context>[]
  /** Widget registry for rich UI responses */
  widgets?: DescribeRegistry
  /** Model to use for widget selection */
  widgetsPickerModel?: LanguageModel
  /** Provider-specific options (e.g. thinking budget for Claude) */
  providerOptions?: Record<string, Record<string, JSONValue>>
  /** Memory for reading/storing messages */
  memory: Memory
  /** Application-level context */
  context: Context
}

/**
 * Result returned by handleAgentStep.
 * An async generator that yields runtime events (including step-begin/end) and returns the finish reason.
 * Messages are stored directly to memory within the step execution.
 */
export type AgentStepMiddlewareResult<Custom extends { type: string } = never> = AsyncGenerator<RuntimeYield<Custom>, FinishReason, void>

/**
 * Context provided to shouldDescendIntoAgent.
 * Contains origin/current/candidate agent details for propagation decisions.
 */
export type DescendIntoAgentInfo<Context = any> = {
  /** The agent where this middleware was originally attached */
  readonly origin: Agent<Context>
  /** The current parent agent invoking the candidate subagent */
  readonly parent: Agent<Context>
  /** The candidate child agent being considered for descent */
  readonly candidate: Agent<Context>
}

/**
 * Context provided to shouldDescendIntoTool.
 * Contains origin/current/candidate details for tool propagation decisions.
 */
export type DescendIntoToolInfo<Context = any> = {
  /** The agent where this middleware was originally attached */
  readonly origin: Agent<Context>
  /** The current parent agent invoking the candidate tool */
  readonly parent: Agent<Context>
  /** The candidate child tool being considered for descent */
  readonly candidate: Tool<Context, any, any, any>
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
 * Middleware handlers are async generator methods that yield events and return
 * the final result. Use `yield*` to delegate to the next middleware in the chain.
 *
 * @example
 * ```typescript
 * function logging(): Middleware {
 *   return {
 *     async *handleAgent(c, next) {
 *       console.log("Agent starting")
 *       const result = yield* next(c)
 *       console.log("Agent completed")
 *       return result
 *     },
 *     async *handleTool(c, next) {
 *       console.log("Tool starting:", c.tool.name)
 *       return yield* next(c)
 *     },
 *     shouldDescendIntoAgent: () => true,
 *     shouldDescendIntoTool: () => true,
 *   }
 * }
 * ```
 */
export interface Middleware<Context = any, Custom extends { type: string } = never> {
  /**
   * Wrap agent execution. Implement as an async generator to modify context,
   * transform stream, implement retry logic, caching, or short-circuit execution.
   *
   * Use `yield*` to delegate to the next middleware and capture the return value.
   *
   * If not provided, passes through to next.
   */
  handleAgent?(
    c: AgentMiddlewareContext<Context>,
    next: (c: AgentMiddlewareContext<Context>) => AgentMiddlewareResult<Context, Custom>,
  ): AgentMiddlewareResult<Context, Custom>

  /**
   * Wrap tool execution. Implement as an async generator to modify input,
   * transform stream, implement retry logic, or intercept output.
   *
   * Use `yield*` to delegate to the next middleware and capture the return value.
   *
   * If not provided, passes through to next.
   */
  handleTool?<Input, Output>(
    c: ToolMiddlewareContext<Context, Input>,
    next: (c: ToolMiddlewareContext<Context, Input>) => ToolMiddlewareResult<Output, Custom>,
  ): ToolMiddlewareResult<Output, Custom>

  /**
   * Wrap individual LLM step execution within an agent loop. Implement as an
   * async generator to modify step context, implement per-step retry/fallback,
   * or intercept step results.
   *
   * This is called for each step in the agent loop, allowing fine-grained control
   * over individual LLM calls rather than the entire agent execution.
   *
   * Use `yield*` to delegate to the next middleware and capture the return value.
   *
   * If not provided, passes through to next.
   *
   * @example
   * ```typescript
   * async *handleAgentStep(c, next) {
   *   console.log(`Step ${c.step} starting with model:`, c.model.modelId)
   *   const result = yield* next(c)
   *   console.log(`Step ${c.step} finished:`, result)
   *   return result
   * }
   * ```
   */
  handleAgentStep?(
    c: AgentStepMiddlewareContext<Context>,
    next: (c: AgentStepMiddlewareContext<Context>) => AgentStepMiddlewareResult<Custom>,
  ): AgentStepMiddlewareResult<Custom>

  /**
   * Whether this middleware should be applied to the given subagent.
   * Called when a parent agent invokes a subagent.
   *
   * Receives origin/current/candidate agent details in `info`.
   *
   * If not provided, defaults to false (middleware stays on current agent only).
   */
  shouldDescendIntoAgent?(info: DescendIntoAgentInfo<Context>): boolean

  /**
   * Whether this middleware should be applied to the given tool.
   * Called when an agent invokes a tool.
   *
   * Receives origin/current/candidate details in `info`.
   *
   * Note: if `handleTool` is defined, middleware automatically applies to tools
   * belonging to the origin agent. This method controls descent into tools
   * invoked by descendant agents.
   */
  shouldDescendIntoTool?(info: DescendIntoToolInfo<Context>): boolean
}
