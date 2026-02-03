/**
 * Factory functions for creating execution graph nodes.
 *
 * The graph system builds a tree of execution nodes representing the call graph:
 * - RootExecutionNode: entry point for top-level agent executions
 * - AgentExecutionNode: tracks an agent's execution (input, messages, events)
 * - ToolExecutionNode: tracks a tool's execution (input, output, events)
 *
 * Nodes auto-register with their parent, forming a tree that can be serialized
 * via toJSON() for debugging and observability.
 */

import type { ModelMessage } from "ai"
import { randomUUID } from "crypto"
import type { RuntimeYield, ToolYield } from "../types"
import type {
  AgentExecutionNode,
  ToolExecutionNode,
  RootExecutionNode,
  ExecutionNode,
  NodeStatus,
  SerializedNode,
  SerializedAgentNode,
  SerializedToolNode,
  SerializedRootNode,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Internal builders
// ─────────────────────────────────────────────────────────────────────────────

interface AgentNodeInit {
  id: string
  name: string
  input: string
  parent: ExecutionNode | null
  status?: NodeStatus
  error?: Error
  messages?: ModelMessage[]
  events?: RuntimeYield[]
}

interface ToolNodeInit {
  id: string
  name: string
  input: unknown
  parent: ExecutionNode | null
  status?: NodeStatus
  error?: Error
  output?: unknown
  events?: ToolYield[]
}

interface RootNodeInit {
  id: string
  name: string
  parent: ExecutionNode | null
  status?: NodeStatus
  error?: Error
  events?: RuntimeYield[]
}

/**
 * Internal builder for agent nodes. Used by both create and deserialize.
 */
function buildAgentNode(init: AgentNodeInit): AgentExecutionNode {
  const { id, name, input, parent } = init
  const children: ExecutionNode[] = []
  const events: RuntimeYield[] = init.events ? [...init.events] : []
  let messages: ModelMessage[] = init.messages ? [...init.messages] : []
  let status: NodeStatus = init.status ?? "pending"
  let error: Error | undefined = init.error

  const node: AgentExecutionNode = {
    id,
    type: "agent",
    name,
    input,
    get status() {
      return status
    },
    get error() {
      return error
    },
    get messages() {
      return messages
    },
    get events() {
      return events
    },
    parent,
    get children() {
      return children
    },

    addChild(child) {
      children.push(child)
    },
    addEvent(event) {
      events.push(event)
      return event
    },
    setStatus(s) {
      status = s
    },
    setError(e) {
      error = e
    },
    setMessages(m) {
      messages = m
    },
    toJSON() {
      return {
        id,
        type: "agent" as const,
        name,
        input,
        status,
        error: error ? { message: error.message, stack: error.stack } : undefined,
        messages,
        events,
        children: children.map((c) => c.toJSON()),
      }
    },
  }

  // Auto-register with parent
  if (parent) {
    parent.addChild(node)
  }

  return node
}

/**
 * Internal builder for tool nodes. Used by both create and deserialize.
 */
function buildToolNode(init: ToolNodeInit): ToolExecutionNode {
  const { id, name, input, parent } = init
  const children: ExecutionNode[] = []
  const events: ToolYield[] = init.events ? [...init.events] : []
  let output: unknown = init.output
  let status: NodeStatus = init.status ?? "pending"
  let error: Error | undefined = init.error

  const node: ToolExecutionNode = {
    id,
    type: "tool",
    name,
    input,
    get status() {
      return status
    },
    get error() {
      return error
    },
    get output() {
      return output
    },
    get events() {
      return events
    },
    parent,
    get children() {
      return children
    },

    addChild(child) {
      children.push(child)
    },
    addEvent(event) {
      events.push(event)
      return event
    },
    setStatus(s) {
      status = s
    },
    setError(e) {
      error = e
    },
    setOutput(o: unknown) {
      output = o
    },
    toJSON() {
      return {
        id,
        type: "tool" as const,
        name,
        input,
        status,
        error: error ? { message: error.message, stack: error.stack } : undefined,
        output,
        events,
        children: children.map((c) => c.toJSON()),
      }
    },
  }

  // Auto-register with parent
  if (parent) {
    parent.addChild(node)
  }

  return node
}

/**
 * Internal builder for root nodes. Used by both create and deserialize.
 */
function buildRootNode(init: RootNodeInit): RootExecutionNode {
  const { id, name, parent } = init
  const children: ExecutionNode[] = []
  const events: RuntimeYield[] = init.events ? [...init.events] : []
  let status: NodeStatus = init.status ?? "pending"
  let error: Error | undefined = init.error

  const node: RootExecutionNode = {
    id,
    type: "root",
    name,
    get status() {
      return status
    },
    get error() {
      return error
    },
    get events() {
      return events
    },
    parent,
    get children() {
      return children
    },

    addChild(child) {
      children.push(child)
    },
    addEvent(event) {
      events.push(event)
      return event
    },
    setStatus(s) {
      status = s
    },
    setError(e) {
      error = e
    },
    toJSON() {
      return {
        id,
        type: "root" as const,
        name,
        status,
        error: error ? { message: error.message, stack: error.stack } : undefined,
        events,
        children: children.map((c) => c.toJSON()),
      }
    },
  }

  // Auto-register with parent (root nodes typically don't have parents, but support it for consistency)
  if (parent) {
    parent.addChild(node)
  }

  return node
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Create nodes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a RootExecutionNode for tracking top-level agent execution.
 * Root nodes serve as the entry point and don't have parents.
 */
export function createRootNode(name = "root"): RootExecutionNode {
  return buildRootNode({ id: randomUUID(), name, parent: null })
}

/**
 * Creates an AgentExecutionNode for tracking agent execution.
 * Auto-registers with parent if provided.
 */
export function createAgentNode(name: string, input: string, parent: ExecutionNode | null = null): AgentExecutionNode {
  return buildAgentNode({ id: randomUUID(), name, input, parent })
}

/**
 * Creates a ToolExecutionNode for tracking tool execution.
 * Auto-registers with parent if provided.
 */
export function createToolNode<Input = unknown>(name: string, input: Input, parent: ExecutionNode | null = null): ToolExecutionNode {
  return buildToolNode({ id: randomUUID(), name, input, parent })
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: Serialize / Deserialize
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes an execution node tree to a JSON string.
 * Handles circular parent references by excluding them from serialization.
 */
export function serializeNode(node: ExecutionNode): string {
  return JSON.stringify(node.toJSON())
}

/**
 * Deserializes a JSON string back into an execution node tree.
 * Reconstructs parent/child relationships and all node methods.
 */
export function deserializeNode(json: string, parent: ExecutionNode | null = null): ExecutionNode {
  const data = JSON.parse(json) as SerializedNode
  return deserializeNodeData(data, parent)
}

/**
 * Deserializes a parsed JSON object back into an execution node tree.
 * Useful when you already have the parsed data.
 */
export function deserializeNodeData(data: SerializedNode, parent: ExecutionNode | null = null): ExecutionNode {
  const error = data.error ? Object.assign(new Error(data.error.message), { stack: data.error.stack }) : undefined

  if (data.type === "agent") {
    return deserializeAgentNode(data, parent, error)
  }
  if (data.type === "root") {
    return deserializeRootNode(data, parent, error)
  }
  return deserializeToolNode(data, parent, error)
}

function deserializeAgentNode(data: SerializedAgentNode, parent: ExecutionNode | null, error: Error | undefined): AgentExecutionNode {
  const node = buildAgentNode({
    id: data.id,
    name: data.name,
    input: data.input,
    parent,
    status: data.status,
    error,
    messages: data.messages,
    events: data.events,
  })

  // Recursively deserialize children (they auto-register with this node as parent)
  for (const childData of data.children) {
    deserializeNodeData(childData, node)
  }

  return node
}

function deserializeToolNode(data: SerializedToolNode, parent: ExecutionNode | null, error: Error | undefined): ToolExecutionNode {
  const node = buildToolNode({
    id: data.id,
    name: data.name,
    input: data.input,
    parent,
    status: data.status,
    error,
    output: data.output,
    events: data.events,
  })

  // Recursively deserialize children (they auto-register with this node as parent)
  for (const childData of data.children) {
    deserializeNodeData(childData, node)
  }

  return node
}

function deserializeRootNode(data: SerializedRootNode, parent: ExecutionNode | null, error: Error | undefined): RootExecutionNode {
  const node = buildRootNode({
    id: data.id,
    name: data.name,
    parent,
    status: data.status,
    error,
    events: data.events,
  })

  // Recursively deserialize children (they auto-register with this node as parent)
  for (const childData of data.children) {
    deserializeNodeData(childData, node)
  }

  return node
}
