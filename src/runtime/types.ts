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

export type BaseYield = { path: string[] }

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
  system: string
  messages: ModelMessage[]
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
// Ref (Mutable Reference with Proxy)
// =============================================================================

/**
 * A mutable reference that proxies property access to the current value.
 *
 * This allows direct property access (e.g., `ref.status`) while also supporting
 * `ref.current` to get the full object and `ref.set(value)` to update it.
 *
 * Used for values that may change during async stream consumption (e.g., retry
 * middleware updating the node/context after switching to a fallback model).
 */
export type Ref<T extends object> = T & {
  /** The current referenced value */
  readonly current: T
  /** Update the referenced value */
  set(value: T): void
}

/**
 * Creates a mutable reference that proxies property access to the current value.
 *
 * @example
 * ```typescript
 * const node = createRef(initialNode)
 *
 * // Direct property access (proxied to current)
 * console.log(node.status)  // same as node.current.status
 *
 * // Update the reference
 * node.set(newNode)
 *
 * // Access full object
 * console.log(node.current)
 * ```
 */
export function createRef<T extends object>(initial: T): Ref<T> {
  let _current = initial

  const handler: ProxyHandler<object> = {
    get(_, prop) {
      if (prop === "current") return _current
      if (prop === "set")
        return (value: T) => {
          _current = value
        }
      // Forward to current value
      const value = (_current as Record<string | symbol, unknown>)[prop]
      // If it's a function, bind it to current so `this` works correctly
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(_current)
      }
      return value
    },
    set(_, prop, value) {
      // Don't allow setting current or set directly
      if (prop === "current" || prop === "set") return false
      ;(_current as Record<string | symbol, unknown>)[prop] = value
      return true
    },
    has(_, prop) {
      return prop === "current" || prop === "set" || prop in _current
    },
    ownKeys() {
      return [...Reflect.ownKeys(_current), "current", "set"]
    },
    getOwnPropertyDescriptor(_, prop) {
      if (prop === "current") {
        return { configurable: true, enumerable: false, value: _current }
      }
      if (prop === "set") {
        return {
          configurable: true,
          enumerable: false,
          value: (v: T) => {
            _current = v
          },
        }
      }
      return Object.getOwnPropertyDescriptor(_current, prop)
    },
  }

  return new Proxy({}, handler) as Ref<T>
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

export type AgentConfig<Context = {}> = {
  name: string
  description: string
  /** System prompt - can be string or function of context */
  system?: string | ((context: Context) => string)
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
  /** loop prompt */
  prompt: UserModelMessage | string
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
 * Note: `node` and `context` are getters that read from internal mutable refs.
 * If using retry middleware, these values reflect the successful attempt after
 * stream consumption completes.
 *
 * @example
 * ```typescript
 * const result = agent.run(prompt, ctx)
 *
 * for await (const event of result.stream) { ... }
 *
 * // Access node and context (reflects successful attempt after stream consumed)
 * console.log(result.node.status)
 * console.log(result.context.model)
 * ```
 */
export type AgentResult<Context = any> = {
  /** Async generator yielding all execution events */
  stream: AsyncGenerator<RuntimeYield, void, unknown>
  /** Memory that was used (might have been created fresh if needed) */
  memory: Memory
  /** Execution graph (root node if top-level, or existing parent if sub-agent) */
  graph: ExecutionNode
  /** This agent's execution node (reflects successful attempt after stream consumed) */
  readonly node: AgentExecutionNode
  /** The loop context used (reflects successful attempt's context, including model) */
  readonly context: AgentLoopContext<Context>
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

export function isAgentError(event: RuntimeYield): event is AgentErrorYield {
  return event.type === "agent-error"
}

export function isAgentStream(event: RuntimeYield): event is AgentStreamYield {
  return event.type === "agent-stream"
}

export function isWidgetDelta(event: RuntimeYield): event is WidgetDeltaYield {
  return event.type === "widget-delta"
}
