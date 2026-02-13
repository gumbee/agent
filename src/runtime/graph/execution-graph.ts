/**
 * Event-driven execution graph builder.
 *
 * Processes RuntimeYield events to build a rich, typed graph of agent/tool
 * execution. Reusable in both the agent runtime (builds graph during execution)
 * and the observability package (builds graph from events received via HTTP).
 */

import type { ModelMessage, JSONValue } from "ai"
import type { AgentYield, WithMetadata, YieldMetadata, RuntimeYield, ToolYield, ThinkingConfig } from "../types"

// =============================================================================
// Node Status
// =============================================================================

export type NodeStatus = "pending" | "running" | "completed" | "failed"

// =============================================================================
// Execution Graph Node Types
// =============================================================================

/** Base fields shared by all graph nodes */
interface ExecutionNodeBase {
  id: string
  name?: string
  status: NodeStatus
  error?: { message: string; stack?: string }
  children: ExecutionGraphNode[]
  parent: ExecutionGraphNode | null
}

/** Root node -- entry point for a top-level execution */
export interface ExecutionRootNode extends ExecutionNodeBase {
  type: "root"
}

/** Agent node -- tracks an agent's execution */
export interface ExecutionAgentNode extends ExecutionNodeBase {
  type: "agent"
  input?: unknown
  messages: ModelMessage[]
  events: WithMetadata<AgentYield>[]
  modelId?: string
  provider?: string
  models?: Array<{ step: number; modelId: string; provider: string; success?: boolean }>
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
  thinking?: ThinkingConfig
}

/** Tool node -- tracks a tool's execution */
export interface ExecutionToolNode extends ExecutionNodeBase {
  type: "tool"
  input?: unknown
  output?: unknown
  events: WithMetadata<ToolYield>[]
}

/** Unknown node -- tracks events for an unknown node */
export interface ExecutionUnknownNode extends ExecutionNodeBase {
  type: "unknown"
  events: WithMetadata<RuntimeYield<any>>[]
}

/** Union of all graph node types */
export type ExecutionGraphNode = ExecutionRootNode | ExecutionAgentNode | ExecutionToolNode | ExecutionUnknownNode

// =============================================================================
// ExecutionGraph
// =============================================================================

/**
 * Builds a rich execution graph from RuntimeYield events.
 *
 * @example Agent runtime usage:
 * ```typescript
 * const graph = new ExecutionGraph()
 * for await (const event of stream) {
 *   graph.processEvent(event)
 * }
 * console.log(graph.root)
 * ```
 */
export class ExecutionGraph {
  private nodeMap = new Map<string, ExecutionGraphNode>()
  private _root: ExecutionRootNode | null = null
  private _nodeStepMap = new Map<string, number>()

  /** Get the root node */
  get root(): ExecutionRootNode | null {
    return this._root
  }

  /** Get a node by ID */
  getNode(id: string): ExecutionGraphNode | undefined {
    return this.nodeMap.get(id)
  }

  /** Process a single event, updating the graph */
  processEvent(event: WithMetadata<RuntimeYield<any>>): void {
    switch (event.type) {
      case "agent-begin": {
        const agentNode = this.ensureAgentNode(event.nodeId, event.parentId)
        agentNode.name = event.name
        agentNode.input = event.input
        agentNode.events.push(event)

        // If no parent, this is the root agent -- wrap in a root node
        if (!this._root && !event.parentId) {
          const rootNode: ExecutionRootNode = {
            id: `root-${agentNode.id}`,
            type: "root",
            name: agentNode.name,
            status: "running",
            children: [agentNode],
            parent: null,
          }
          agentNode.parent = rootNode
          this._root = rootNode
          this.nodeMap.set(rootNode.id, rootNode)
        }
        break
      }

      case "agent-end": {
        const node = this.ensureAgentNode(event.nodeId)
        node.status = "completed"
        node.events.push(event)
        this._nodeStepMap.delete(event.nodeId)
        // Also mark root as completed if this is the root agent
        if (this._root && this._root.children[0]?.id === event.nodeId) {
          this._root.status = "completed"
        }
        break
      }

      case "agent-error": {
        const node = this.ensureAgentNode(event.nodeId)
        node.status = "failed"
        node.error = { message: event.error.message, stack: event.error.stack }
        node.events.push(event)
        this._nodeStepMap.delete(event.nodeId)
        // Also mark root as failed if this is the root agent
        if (this._root && this._root.children[0]?.id === event.nodeId) {
          this._root.status = "failed"
        }
        break
      }

      case "agent-step-llm-call": {
        const node = this.ensureAgentNode(event.nodeId)
        node.events.push(event)
        if (!node.modelId) {
          node.modelId = event.modelId
          node.provider = event.provider
        }
        const step = this._nodeStepMap.get(event.nodeId) ?? 0
        if (!node.models) {
          node.models = []
        }
        node.models.push({ step, modelId: event.modelId, provider: event.provider })
        if (event.providerOptions) {
          node.thinking = normalizeThinking(event.providerOptions)
        }
        break
      }

      case "agent-stream": {
        const node = this.ensureAgentNode(event.nodeId)
        node.events.push(event)
        if (event.part.type === "finish-step" && event.part.usage) {
          const usage = event.part.usage
          const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens
          const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens
          node.usage = {
            inputTokens: (node.usage?.inputTokens ?? 0) + (usage.inputTokens ?? 0),
            outputTokens: (node.usage?.outputTokens ?? 0) + (usage.outputTokens ?? 0),
            totalTokens: (node.usage?.totalTokens ?? 0) + (usage.totalTokens ?? 0),
            cacheReadTokens: cacheRead != null ? (node.usage?.cacheReadTokens ?? 0) + cacheRead : node.usage?.cacheReadTokens,
            cacheWriteTokens: cacheWrite != null ? (node.usage?.cacheWriteTokens ?? 0) + cacheWrite : node.usage?.cacheWriteTokens,
          }
        }
        break
      }

      case "agent-step-begin": {
        const node = this.ensureAgentNode(event.nodeId)
        node.events.push(event)
        this._nodeStepMap.set(event.nodeId, event.step)
        break
      }

      case "widget-delta": {
        const node = this.ensureAgentNode(event.nodeId)
        node.events.push(event)
        break
      }

      case "agent-step-end": {
        const node = this.ensureAgentNode(event.nodeId)
        node.events.push(event)
        const lastModel = node.models?.at(-1)
        if (lastModel) {
          lastModel.success = true
        }
        // Store appended messages on agent node
        if (event.appended) {
          node.messages = [...node.messages, ...event.appended]
        }
        break
      }

      case "tool-begin": {
        const toolNode = this.ensureToolNode(event.toolCallId, event.parentId)
        toolNode.name = event.tool
        toolNode.input = event.input
        toolNode.events.push(event)
        break
      }

      case "tool-end": {
        const node = this.ensureToolNode(event.toolCallId)
        node.status = "completed"
        node.output = event.output
        node.events.push(event)
        break
      }

      case "tool-error": {
        const node = this.ensureToolNode(event.toolCallId)
        node.status = "failed"
        node.error = { message: event.error.message, stack: event.error.stack }
        node.events.push(event)
        break
      }

      case "tool-progress": {
        const node = this.ensureToolNode(event.toolCallId)
        node.events.push(event)
        break
      }

      case "agent-step-retry": {
        const node = this.ensureAgentNode(event.nodeId)
        node.events.push(event)
        const lastModel = node.models?.at(-1)
        if (lastModel) {
          lastModel.success = false
        }
        break
      }

      default: {
        // Handle custom yield types (any yield with nodeId gets attached to its agent node)
        const customEvent = event as YieldMetadata & { toolCallId?: string }
        const id = customEvent.nodeId || customEvent.toolCallId || "unknown"
        const parentId = customEvent.parentId
        const node = this.ensureNode(id, parentId)

        node.events.push(event)

        break
      }
    }
  }

  private ensureNode(nodeId: string, parentId?: string): ExecutionAgentNode | ExecutionToolNode | ExecutionUnknownNode {
    let node = this.nodeMap.get(nodeId)
    if (!node) {
      node = {
        id: nodeId,
        type: "unknown",
        status: "running",
        events: [],
        children: [],
        parent: null,
      }

      this.nodeMap.set(nodeId, node)
    }

    // Connect to parent if provided and not yet connected
    if (parentId && !node.parent) {
      const parent = this.nodeMap.get(parentId)
      if (parent) {
        node.parent = parent
        if (!parent.children.includes(node)) {
          parent.children.push(node)
        }
      }
    }

    // If still no parent and no root exists, make this the root
    if (!node.parent && !this._root) {
      const rootNode: ExecutionRootNode = {
        id: `root-${nodeId}`,
        type: "root",
        name: "Unknown Execution",
        status: "running",
        children: [node],
        parent: null,
      }
      node.parent = rootNode
      this._root = rootNode
      this.nodeMap.set(rootNode.id, rootNode)
    }

    return node as ExecutionAgentNode | ExecutionToolNode | ExecutionUnknownNode
  }

  private ensureAgentNode(nodeId: string, parentId?: string): ExecutionAgentNode {
    let node = this.nodeMap.get(nodeId)
    if (!node) {
      node = {
        id: nodeId,
        type: "agent",
        status: "running",
        messages: [],
        events: [],
        children: [],
        parent: null,
      }
      this.nodeMap.set(nodeId, node)
    }

    // Connect to parent if provided and not yet connected
    if (parentId && !node.parent) {
      const parent = this.ensureNode(parentId)
      node.parent = parent
      if (!parent.children.includes(node)) {
        parent.children.push(node)
      }
    }

    if (node.type !== "agent") {
      if (node.type === "unknown") {
        const upgraded = node as unknown as ExecutionAgentNode
        upgraded.type = "agent"
        upgraded.messages = []
        return upgraded
      }
      throw new Error(`Node ${nodeId} exists but is not an agent (type: ${node.type})`)
    }

    return node
  }

  private ensureToolNode(toolCallId: string, parentId?: string): ExecutionToolNode {
    let node = this.nodeMap.get(toolCallId)
    if (!node) {
      node = {
        id: toolCallId,
        type: "tool",
        status: "running",
        events: [],
        children: [],
        parent: null,
      }
      this.nodeMap.set(toolCallId, node)
    }

    // Connect to parent if provided and not yet connected
    if (parentId && !node.parent) {
      const parent = this.ensureNode(parentId)
      node.parent = parent
      if (!parent.children.includes(node)) {
        parent.children.push(node)
      }
    }

    if (node.type !== "tool") {
      if (node.type === "unknown") {
        const upgraded = node as unknown as ExecutionToolNode
        upgraded.type = "tool"
        return upgraded
      }
      throw new Error(`Node ${toolCallId} exists but is not a tool (type: ${node.type})`)
    }

    return node
  }
}

function normalizeThinking(providerOptions: Record<string, Record<string, JSONValue>>): ThinkingConfig {
  if (providerOptions.anthropic?.thinking && typeof providerOptions.anthropic.thinking === "object") {
    const thinking = providerOptions.anthropic.thinking as Record<string, JSONValue>
    if (thinking.type === "enabled") {
      return { enabled: true, budgetTokens: thinking.budgetTokens as number }
    }
  }

  if (providerOptions.openai?.reasoningEffort) {
    return { enabled: true, level: providerOptions.openai.reasoningEffort as "low" | "medium" | "high" }
  }

  if (providerOptions.google?.thinkingConfig && typeof providerOptions.google.thinkingConfig === "object") {
    const thinkingConfig = providerOptions.google.thinkingConfig as Record<string, JSONValue>
    if (thinkingConfig.includeThoughts || typeof thinkingConfig.thinkingBudget === "number") {
      const budget = (thinkingConfig.thinkingBudget as number) ?? 0
      let level: "minimal" | "low" | "medium" | "high" = "minimal"

      if (budget >= 4096) {
        level = "high"
      } else if (budget >= 1024) {
        level = "medium"
      } else if (budget >= 300) {
        level = "low"
      }

      return { enabled: true, budgetTokens: budget, level }
    }
  }

  return { enabled: false }
}
