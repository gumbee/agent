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
import type { Middleware } from "./middleware"
import type { ExecutionGraph } from "./graph/execution-graph"

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
  runId: string
}

export type Runner<Context = any, Input = any, Yields = any, Return = any> = {
  readonly __runner__: true

  name: string
  description?: string
  instructions?: string

  execute: (input: Input, context: Context, env: RunnerEnvironment) => AsyncGenerator<Yields, Return>
}

// =============================================================================
// Yield Metadata (runtime-injected fields)
// =============================================================================

export type BaseYield = { path: string[]; timestamp: number }

/** Metadata automatically injected by the runtime onto yielded events */
export type YieldMetadata = BaseYield & { nodeId: string; parentId?: string }

/** Wraps a yield type with runtime metadata fields (path, timestamp, nodeId, parentId) */
export type WithMetadata<T extends { type: string }> = [T] extends [never] ? never : T & YieldMetadata

/** @deprecated Use `WithMetadata<YourEventType>` instead */
export type CustomYieldBase = YieldMetadata & { type: string }

// =============================================================================
// Yield Types (events emitted during execution — without metadata)
// =============================================================================

// Tool yields
export type ToolBeginYield = { type: "tool-begin"; tool: string; toolCallId: string; input?: unknown }
export type ToolEndYield = { type: "tool-end"; tool: string; toolCallId: string; output?: unknown }
export type ToolErrorYield = { type: "tool-error"; tool: string; toolCallId: string; error: Error }
export type ToolProgressYield<T = unknown> = { type: "tool-progress"; tool: string; toolCallId: string; event: T }
export type ToolYield = ToolBeginYield | ToolEndYield | ToolErrorYield | ToolProgressYield

export type ThinkingConfig = {
  enabled: boolean
  level?: "minimal" | "low" | "medium" | "high"
  budgetTokens?: number
}

// Agent yields
export type AgentBeginYield = { type: "agent-begin"; name: string; input: unknown }
export type AgentEndYield = { type: "agent-end" }
export type AgentStepBeginYield = { type: "agent-step-begin"; step: number }
export type AgentStepLLMCallYield = {
  type: "agent-step-llm-call"
  system: string
  messages: ModelMessage[]
  modelId: string
  provider: string
  providerOptions?: Record<string, Record<string, JSONValue>>
}
export type AgentStepEndYield = {
  type: "agent-step-end"
  step: number
  finishReason: FinishReason
  appended: ModelMessage[]
}
export type AgentErrorYield = { type: "agent-error"; error: Error }
export type AgentStreamYield = { type: "agent-stream"; part: TextStreamPart<ToolSet> }

// Widget yield (extension for rich UI)
export type WidgetDeltaYield<T = unknown> = { type: "widget-delta"; index: number; widget: T }

// Agent step retry yield (emitted by fallback middleware)
export type AgentStepRetryYield = {
  type: "agent-step-retry"
  step: number
  attempt: number
  error: string
  toModelId: string
  toProvider: string
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
  | AgentStepRetryYield

// =============================================================================
// Runtime Yield (union of all event types)
// =============================================================================

// Combined yields for agent execution (agents can yield both agent and tool events)
// Generic `Custom` parameter allows extending with user-defined yield types
export type RuntimeYield<Custom extends { type: string } = never> = AgentYield | ToolYield | Custom

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

export type Tool<Context = any, Input = any, Output = any, CustomYields = never> = Runner<
  Context,
  Input,
  WithMetadata<ToolYield> | CustomYields,
  Output
> & {
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

export type AgentConfig<Context = {}, Input = string, Output = { response: string }, Yield extends { type: string } = never> = {
  name: string
  description: string
  /** System prompt - can be string or function of context */
  system?: SystemPrompt<Context>
  /** Instructions for when agent is used as a sub-agent (not used if root) */
  instructions?: string
  /** Optional input schema for the agent when it's used as a subagent call (called as a tool) */
  input?: z.ZodSchema<Input>
  /** Maps structured input to a prompt for the LLM. Required when Input is not string. */
  toPrompt?: (input: Input) => string | UserModelMessage
  /** Optional custom execution logic */
  execute?: (
    run: (input: Input) => AgentResult<Context, any>,
    input: Input,
    context: Context,
    env: RunnerEnvironment,
  ) => AsyncGenerator<Yield, Output> | Promise<Output>
  model: LanguageModel
  /** Optional default memory (can be overridden via run options) */
  memory?: Memory
  /** Optional default middleware (can be extended via run options) */
  middleware?: Middleware<Context, any>[]
  tools?: Runner<Context>[]
  stopCondition?: StopCondition
  /** Widget registry for rich UI responses */
  widgets?: DescribeRegistry
  /** Model to use for widget selection (defaults to main model) */
  widgetsPickerModel?: LanguageModel
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
  middleware?: Middleware<Context, any>[]
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
  /** The input/prompt that triggered this agent */
  input: unknown
  /** Maps structured input to a prompt for the LLM */
  toPrompt?: (input: unknown) => string | UserModelMessage
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
 * Agent result containing stream, memory, and execution graph.
 *
 * The `graph` is an ExecutionGraph that is populated as the stream is consumed.
 * The `context` promise resolves when the stream is fully consumed.
 *
 * @example
 * ```typescript
 * const result = agent.run(prompt, ctx)
 *
 * for await (const event of result.stream) { ... }
 *
 * // Access the execution graph (populated after stream consumed)
 * console.log(result.graph.root)
 * ```
 */
export type AgentResult<Context = any, Custom extends { type: string } = never> = {
  /** Async generator yielding all execution events (with runtime metadata) */
  stream: AsyncGenerator<WithMetadata<RuntimeYield<Custom>>, void, unknown>
  /** Memory that was used (might have been created fresh if needed) */
  memory: Memory
  /** Execution graph built from events (populated as stream is consumed) */
  graph: ExecutionGraph
  /** The loop context used (resolves after stream consumed, reflects successful attempt's context) */
  context: Promise<AgentLoopContext<Context>>
  /** Abort the agent execution (cancels LLM calls, tools, and the loop) */
  abort: () => void
}

export type Agent<Context = {}, Input = string, Output = { response: string }, Custom extends { type: string } = never> = Runner<
  Context,
  Input,
  WithMetadata<RuntimeYield<Custom>>,
  Output
> & {
  input?: z.ZodSchema<Input>
  run(input: Input, context: Context, options?: AgentRunOptions<Context>): AgentResult<Context, Custom>
}

// =============================================================================
// Type Guards
// =============================================================================

// Type guards are generic so they work with both raw yields and WithMetadata<> wrapped yields.
// The intersection `T & XxxYield` preserves metadata fields when present.

export function isToolBegin<T extends { type: string }>(event: T): event is T & ToolBeginYield {
  return event.type === "tool-begin"
}

export function isToolEnd<T extends { type: string }>(event: T): event is T & ToolEndYield {
  return event.type === "tool-end"
}

export function isToolError<T extends { type: string }>(event: T): event is T & ToolErrorYield {
  return event.type === "tool-error"
}

export function isAgentBegin<T extends { type: string }>(event: T): event is T & AgentBeginYield {
  return event.type === "agent-begin"
}

export function isAgentEnd<T extends { type: string }>(event: T): event is T & AgentEndYield {
  return event.type === "agent-end"
}

export function isAgentStepBegin<T extends { type: string }>(event: T): event is T & AgentStepBeginYield {
  return event.type === "agent-step-begin"
}

export function isAgentStepEnd<T extends { type: string }>(event: T): event is T & AgentStepEndYield {
  return event.type === "agent-step-end"
}

export function isAgentStepLLMCall<T extends { type: string }>(event: T): event is T & AgentStepLLMCallYield {
  return event.type === "agent-step-llm-call"
}

export function isAgentError<T extends { type: string }>(event: T): event is T & AgentErrorYield {
  return event.type === "agent-error"
}

export function isAgentStream<T extends { type: string }>(event: T): event is T & AgentStreamYield {
  return event.type === "agent-stream"
}

export function isWidgetDelta<T extends { type: string }>(event: T): event is T & WidgetDeltaYield {
  return event.type === "widget-delta"
}

export function isAgentStepRetry<T extends { type: string }>(event: T): event is T & AgentStepRetryYield {
  return event.type === "agent-step-retry"
}
