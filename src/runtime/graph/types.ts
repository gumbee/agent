/**
 * Execution graph types for building a graph of agent/tool execution.
 *
 * The graph forms a tree structure where:
 * - RootExecutionNode: entry point for top-level agent executions
 * - AgentExecutionNode: tracks an agent's execution (input, messages, events)
 * - ToolExecutionNode: tracks a tool's execution (input, output, events)
 *
 * Nodes hold direct parent/children references (not IDs) for easy traversal.
 */

import type { ModelMessage } from "ai"
import type { RuntimeYield, ToolYield } from "../types"

export type NodeStatus = "pending" | "running" | "completed" | "failed"

// Note: Graph hooks have been removed. Use Middleware class for observability.
// See runtime/middleware.ts for the new approach.

// Base properties shared by both node types
interface BaseExecutionNode {
  readonly id: string
  readonly name: string
  error?: Error
  status: NodeStatus

  // Tree structure
  readonly parent: ExecutionNode | null
  readonly children: ExecutionNode[]

  // Methods
  addChild(child: ExecutionNode): void
  setStatus(status: NodeStatus): void
  setError(error: Error): void
  toJSON(): SerializedNode
}

// Agent-specific node
export interface AgentExecutionNode extends BaseExecutionNode {
  readonly type: "agent"
  input: string // Agents receive string prompts
  messages: ModelMessage[]
  events: RuntimeYield[]

  // Methods
  addEvent<E extends RuntimeYield>(event: E): E
  setMessages(messages: ModelMessage[]): void
  toJSON(): SerializedAgentNode
}

// Tool-specific node
export interface ToolExecutionNode extends BaseExecutionNode {
  readonly type: "tool"
  input: unknown // Tools receive typed input
  output?: unknown
  events: ToolYield[]

  // Methods
  addEvent<E extends ToolYield>(event: E): E
  setOutput(output: unknown): void
  toJSON(): SerializedToolNode
}

// Root node - entry point for top-level agent executions
export interface RootExecutionNode extends BaseExecutionNode {
  readonly type: "root"
  events: RuntimeYield[]

  // Methods
  addEvent<E extends RuntimeYield>(event: E): E
  toJSON(): SerializedRootNode
}

// Union type for tree structure
export type ExecutionNode = AgentExecutionNode | ToolExecutionNode | RootExecutionNode

// Type guards
export function isAgentNode(node: ExecutionNode): node is AgentExecutionNode {
  return node.type === "agent"
}

export function isToolNode(node: ExecutionNode): node is ToolExecutionNode {
  return node.type === "tool"
}

export function isRootNode(node: ExecutionNode): node is RootExecutionNode {
  return node.type === "root"
}

// Serialized types for JSON representation
export interface SerializedAgentNode {
  id: string
  type: "agent"
  name: string
  input: string
  status: NodeStatus
  error?: { message: string; stack?: string }
  messages: ModelMessage[]
  events: RuntimeYield[]
  children: SerializedNode[]
}

export interface SerializedToolNode {
  id: string
  type: "tool"
  name: string
  input: unknown
  status: NodeStatus
  error?: { message: string; stack?: string }
  output?: unknown
  events: ToolYield[]
  children: SerializedNode[]
}

export interface SerializedRootNode {
  id: string
  type: "root"
  name: string
  status: NodeStatus
  error?: { message: string; stack?: string }
  events: RuntimeYield[]
  children: SerializedNode[]
}

export type SerializedNode = SerializedAgentNode | SerializedToolNode | SerializedRootNode
