/**
 * Browser-compatible entrypoint for the execution graph.
 *
 * This entrypoint only exports the ExecutionGraph class and related types,
 * which have no Node.js dependencies (no async_hooks, no crypto).
 *
 * Use `@gumbee/agent/graph` instead of `@gumbee/agent` when you only need
 * the execution graph in a browser environment (e.g. observability dashboards).
 */

// ExecutionGraph class and node types
export { ExecutionGraph } from "./runtime/graph/execution-graph"
export type {
  ExecutionGraphNode,
  ExecutionRootNode,
  ExecutionAgentNode,
  ExecutionToolNode,
  ExecutionUnknownNode,
  NodeStatus,
} from "./runtime/graph/execution-graph"

// Yield types (pure type definitions, no runtime code)
export type {
  RuntimeYield,
  WithMetadata,
  YieldMetadata,
  CustomYieldBase,
  AgentYield,
  ToolYield,
  AgentBeginYield,
  AgentEndYield,
  AgentStepBeginYield,
  AgentStepLLMCallYield,
  AgentStepEndYield,
  AgentStepRetryYield,
  AgentErrorYield,
  AgentStreamYield,
  WidgetDeltaYield,
  ToolBeginYield,
  ToolEndYield,
  ToolErrorYield,
  ToolProgressYield,
  BaseYield,
  ModelMessage,
  FinishReason,
  ThinkingConfig,
} from "./runtime/types"

// Type guards (pure functions, no Node.js deps)
export {
  isToolBegin,
  isToolEnd,
  isToolError,
  isAgentBegin,
  isAgentEnd,
  isAgentStepBegin,
  isAgentStepLLMCall,
  isAgentStepEnd,
  isAgentStepRetry,
  isAgentError,
  isAgentStream,
  isWidgetDelta,
} from "./runtime/types"
