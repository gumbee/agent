import type {
  FinishReason as AIFinishReason,
  JSONValue,
  LanguageModel,
  ModelMessage as AIModelMessage,
  TextStreamPart,
  ToolSet,
  UserModelMessage,
} from "ai"
import type { DescribeRegistry } from "@gumbee/structured"
import type { z } from "@gumbee/structured"
import type { Memory } from "../memory"
import type { AgentExecutionNode, ExecutionNode } from "./graph/types"
import type { Middleware } from "./middleware"

// =============================================================================
// Re-exports
// =============================================================================

export type ModelMessage = AIModelMessage
export type FinishReason = AIFinishReason | "stop-condition"
export type { LanguageModel, UserModelMessage } from "ai"

// =============================================================================
// Runner Interface (base for both agents and tools)
// =============================================================================

export type RunnerEnvironment = {
  abort?: AbortSignal
  toolCallId: string
}

export type Runner<Context = any, Input = any, Yields = any, Return = any> = {
  readonly __runner__: true

  name: string
  description?: string
  instructions?: string

  execute: (input: Input, context: Context, env: RunnerEnvironment) => AsyncGenerator<Yields, Return>
}

// =============================================================================
// Yield Types (events emitted during execution)
// =============================================================================

export type BaseYield = { path: string[]; timestamp: number }

// Tool yields
export type ToolBeginYield = BaseYield & { type: "tool-begin"; tool: string; toolCallId: string; input?: unknown }
export type ToolEndYield = BaseYield & { type: "tool-end"; tool: string; toolCallId: string; output?: unknown }
export type ToolErrorYield = BaseYield & { type: "tool-error"; tool: string; toolCallId: string; error: Error }
export type ToolProgressYield<T = unknown> = BaseYield & { type: "tool-progress"; tool: string; toolCallId: string; event: T }
export type ToolYield = ToolBeginYield | ToolEndYield | ToolErrorYield | ToolProgressYield

// Agent yields
export type AgentBeginYield = BaseYield & { type: "agent-begin" }
export type AgentEndYield = BaseYield & { type: "agent-end" }
export type AgentStepBeginYield = BaseYield & {
  type: "agent-step-begin"
  step: number
}
export type AgentStepLLMCallYield = BaseYield & {
  type: "agent-step-llm-call"
  system: string
  messages: ModelMessage[]
  modelId: string
  provider: string
}
export type AgentStepEndYield = BaseYield & {
  type: "agent-step-end"
  step: number
  finishReason: FinishReason
  appended: ModelMessage[]
}
export type AgentErrorYield = BaseYield & { type: "agent-error"; error: Error }
export type AgentStreamYield = BaseYield & { type: "agent-stream"; part: TextStreamPart<ToolSet> }

// Widget yield (extension for rich UI)
export type WidgetDeltaYield<T = unknown> = BaseYield & {
  type: "widget-delta"
  index: number
  widget: T
}

export type AgentYield =
  | AgentBeginYield
  | AgentEndYield
  | AgentStepBeginYield
  | AgentStepLLMCallYield
  | AgentStepEndYield
  | AgentErrorYield
  | AgentStreamYield
  | WidgetDeltaYield

// Combined yields for agent execution (agents can yield both agent and tool events)
export type RuntimeYield = AgentYield | ToolYield

// Helper types for extracting tool call/result info from AgentStreamYield parts
/** Tool call info extracted from agent-stream parts (type: "tool-call") */
export type ToolCallInfo = {
  toolCallId: string
  toolName: string
  args: unknown
}

/** Tool result info extracted from agent-stream parts (type: "tool-result") */
export type ToolResultInfo = {
  toolCallId: string
  toolName: string
  output: unknown
}

// =============================================================================
// Tool Types
// =============================================================================

export type ToolConfig<Context = any, Input = any, Output = any, CustomYields = never> = {
  name: string
  description: string
  /** Instructions injected into system prompt when tool is available */
  instructions?: string
  /** Zod schema for input parameters */
  input: z.ZodSchema<Input>
  /** Execute function - can be async generator (yields events) or plain async function */
  execute: (input: Input, context: Context, env: RunnerEnvironment) => AsyncGenerator<CustomYields, Output> | Promise<Output>
}

export type Tool<Context = any, Input = any, Output = any, CustomYields = never> = Runner<Context, Input, ToolYield | CustomYields, Output> & {
  input: z.ZodSchema<Input>
}

// =============================================================================
// LazyPromise (Externally Resolvable Promise)
// =============================================================================

/**
 * A promise that can be resolved or rejected from outside.
 * Useful for bridging async generators with promise-based APIs.
 *
 * @example
 * ```typescript
 * const lazy = new LazyPromise<string>()
 *
 * // Later, resolve it
 * lazy.resolve("done")
 *
 * // Consumers await it like a normal promise
 * const value = await lazy // "done"
 * ```
 */
export class LazyPromise<T> extends Promise<T> {
  resolve!: (value: T | PromiseLike<T>) => void
  reject!: (reason?: unknown) => void

  constructor() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    super((res, rej) => {
      resolve = res
      reject = rej
    })
    this.resolve = resolve
    this.reject = reject
  }
}

// Note: Middleware class and related types are now in ./middleware.ts

// =============================================================================
// Agent Types
// =============================================================================

export type StopConditionInfo = {
  step: number
  finishReason: FinishReason
  messages: ModelMessage[]
}

export type StopCondition = (info: StopConditionInfo) => boolean | Promise<boolean>
export type SystemPrompt<Context = {}> = string | ((context: Context) => Promise<string> | string)

export type AgentConfig<Context = {}> = {
  name: string
  description: string
  /** System prompt - can be string or function of context */
  system?: SystemPrompt<Context>
  /** Instructions for when agent is used as a sub-agent (not used if root) */
  instructions?: string
  model: LanguageModel
  /** Optional default memory (can be overridden via run options) */
  memory?: Memory
  /** Optional default middleware (can be extended via run options) */
  middleware?: Middleware<Context>[]
  tools?: Runner<Context>[]
  stopCondition?: StopCondition
  /** Widget registry for rich UI responses */
  widgets?: DescribeRegistry
  /** Model to use for widget selection (defaults to main model) */
  widgetsPickerModel?: LanguageModel
  maxSteps?: number
  /** Provider-specific options (e.g. thinking budget for Claude) */
  providerOptions?: Record<string, Record<string, JSONValue>>
}

/**
 * Options passed to agent.run()
 */
export type AgentRunOptions<Context = any> = {
  /** Memory instance (overrides config.memory) */
  memory?: Memory
  /** Abort signal for cancellation */
  abort?: AbortSignal
  /** Additional middleware to wrap the stream (appended to config.middleware, applied in order) */
  middleware?: Middleware<Context>[]
}

export type AgentLoopContext<Context> = {
  /** system prompt */
  system?: AgentConfig<Context>["system"]
  /** Memory */
  memory: Memory
  /** Application level context */
  context: Context
  /** Runner environment */
  env: RunnerEnvironment
  /** loop stopper */
  stopCondition: StopCondition
  /** agent configs */
  model: AgentConfig<Context>["model"]
  tools?: AgentConfig<Context>["tools"]
  widgets?: AgentConfig<Context>["widgets"]
  widgetsPickerModel?: AgentConfig<Context>["widgetsPickerModel"]
  providerOptions?: AgentConfig<Context>["providerOptions"]
}

/**
 * Agent result containing stream, memory, and execution graph references.
 *
 * Note: `node` and `context` are promises that resolve when the stream is fully consumed.
 * If using retry middleware, these values reflect the successful attempt after
 * stream consumption completes.
 *
 * @example
 * ```typescript
 * const result = agent.run(prompt, ctx)
 *
 * for await (const event of result.stream) { ... }
 *
 * // Access node and context (resolves after stream consumed)
 * const node = await result.node
 * console.log(node.status)
 *
 * const context = await result.context
 * console.log(context.model)
 * ```
 */
export type AgentResult<Context = any> = {
  /** Async generator yielding all execution events */
  stream: AsyncGenerator<RuntimeYield, void, unknown>
  /** Memory that was used (might have been created fresh if needed) */
  memory: Memory
  /** Execution graph (root node if top-level, or existing parent if sub-agent) */
  graph: ExecutionNode
  /** This agent's execution node (resolves after stream consumed) */
  node: Promise<AgentExecutionNode>
  /** The loop context used (resolves after stream consumed, reflects successful attempt's context) */
  context: Promise<AgentLoopContext<Context>>
}

export type Agent<Context = {}> = Runner<Context, string, RuntimeYield, { response: string }> & {
  run(prompt: string | UserModelMessage, context: Context, options?: AgentRunOptions<Context>): AgentResult<Context>
}

// =============================================================================
// Type Guards
// =============================================================================

export function isToolBegin(event: RuntimeYield): event is ToolBeginYield {
  return event.type === "tool-begin"
}

export function isToolEnd(event: RuntimeYield): event is ToolEndYield {
  return event.type === "tool-end"
}

export function isToolError(event: RuntimeYield): event is ToolErrorYield {
  return event.type === "tool-error"
}

export function isAgentBegin(event: RuntimeYield): event is AgentBeginYield {
  return event.type === "agent-begin"
}

export function isAgentEnd(event: RuntimeYield): event is AgentEndYield {
  return event.type === "agent-end"
}

export function isAgentStepBegin(event: RuntimeYield): event is AgentStepBeginYield {
  return event.type === "agent-step-begin"
}

export function isAgentStepEnd(event: RuntimeYield): event is AgentStepEndYield {
  return event.type === "agent-step-end"
}

export function isAgentStepLLMCall(event: RuntimeYield): event is AgentStepLLMCallYield {
  return event.type === "agent-step-llm-call"
}

export function isAgentError(event: RuntimeYield): event is AgentErrorYield {
  return event.type === "agent-error"
}

export function isAgentStream(event: RuntimeYield): event is AgentStreamYield {
  return event.type === "agent-stream"
}

export function isWidgetDelta(event: RuntimeYield): event is WidgetDeltaYield {
  return event.type === "widget-delta"
}
