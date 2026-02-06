// =============================================================================
// Agent & Tool Factory Functions
// =============================================================================

export { agent } from "./runtime/agent"
export { tool, isTool, convertRunnersForAI, formatToolOutput } from "./runtime/tool"

// =============================================================================
// Run Loop
// =============================================================================

export { executeLoop } from "./runtime/run-loop"

// =============================================================================
// Graph System
// =============================================================================

export { createAgentNode, createToolNode, createRootNode } from "./runtime/graph/node"
export {
  getCurrentNode,
  runWithNode,
  getPath,
  wrapGeneratorWithNode,
  wrapGeneratorWithMiddlewares,
  getMiddlewares,
  runWithMiddlewares,
} from "./runtime/graph/context"
export type { AgentExecutionNode, ToolExecutionNode, RootExecutionNode, ExecutionNode, NodeStatus } from "./runtime/graph/types"
export { isAgentNode, isToolNode, isRootNode } from "./runtime/graph/types"

// =============================================================================
// Middleware System
// =============================================================================

export type { Middleware, AgentMiddlewareContext, AgentMiddlewareResult, ToolMiddlewareContext, ToolMiddlewareResult } from "./runtime/middleware"

// =============================================================================
// Memory
// =============================================================================

export * from "./memory"

// =============================================================================
// Types
// =============================================================================

export type {
  // Core types
  Agent,
  AgentConfig,
  AgentLoopContext,
  AgentResult,
  AgentRunOptions,
  Tool,
  ToolConfig,
  Runner,
  RunnerEnvironment,
  // Yield types
  RuntimeYield,
  AgentYield,
  ToolYield,
  AgentBeginYield,
  AgentEndYield,
  AgentStepBeginYield,
  AgentStepLLMCallYield,
  AgentStepEndYield,
  AgentErrorYield,
  AgentStreamYield,
  WidgetDeltaYield,
  ToolBeginYield,
  ToolEndYield,
  ToolErrorYield,
  ToolProgressYield,
  ToolCallInfo,
  ToolResultInfo,
  BaseYield,
  // Other types
  StopCondition,
  StopConditionInfo,
  ModelMessage,
  FinishReason,
  LanguageModel,
  UserModelMessage,
} from "./runtime/types"

// Type guards for yields
export {
  isToolBegin,
  isToolEnd,
  isToolError,
  isAgentBegin,
  isAgentEnd,
  isAgentStepBegin,
  isAgentStepLLMCall,
  isAgentStepEnd,
  isAgentError,
  isAgentStream,
  isWidgetDelta,
} from "./runtime/types"

// LazyPromise for externally resolvable promises
export { LazyPromise } from "./runtime/types"

// =============================================================================
// Middlewares
// =============================================================================

export * from "./middlewares"

// =============================================================================
// Stop Conditions
// =============================================================================

export { stopAfterSteps, stopOnFinish, stopOnToolCall, stopAny, stopAll, DEFAULT_STOP_CONDITION } from "./runtime/stop-conditions"

// =============================================================================
// Structured Output
// =============================================================================

export { structured, type AiSdkStructuredOptions } from "./structured"

// Re-export schema utilities from @gumbee/structured
export { z, DescribeRegistry } from "@gumbee/structured"
// Re-export query utilities from @gumbee/structured/queries
export { isCompleted } from "@gumbee/structured/queries"

// =============================================================================
// Utilities
// =============================================================================

export { estimateTokenCount, estimateMessageTokens } from "./utils/token-estimator"
