# Execution Graph

Every agent execution creates an execution graph, capturing the full execution tree including tool calls, subagent executions, events, and messages.

## Accessing the Execution Graph

The execution graph is returned from `agent.run()` as an `ExecutionGraph` instance. The graph is populated incrementally as the stream is consumed:

```typescript
const { stream, graph } = myAgent.run("Hello")

// Consume the stream (this populates the graph)
for await (const event of stream) {
  console.log(event)
}

// After streaming completes, access the execution graph
const root = graph.root // ExecutionRootNode
const agentNode = root?.children[0] // ExecutionAgentNode

console.log(agentNode?.status) // "completed" | "failed"
console.log(agentNode?.events) // All events from this agent
```

## The `ExecutionGraph` Class

The `ExecutionGraph` class processes runtime events and builds a typed graph:

```typescript
import { ExecutionGraph } from "@gumbee/agent"

const graph = new ExecutionGraph()

// Process events to build the graph
for await (const event of stream) {
  graph.processEvent(event)
}

// Access the root node
const root = graph.root

// Look up any node by ID
const node = graph.getNode("some-node-id")
```

### Methods

| Method                     | Return Type                    | Description                         |
| -------------------------- | ------------------------------ | ----------------------------------- |
| `root`                     | `ExecutionRootNode \| null`    | Getter for the root node            |
| `getNode(id)`              | `ExecutionGraphNode \| undefined` | Look up any node by its ID      |
| `processEvent(event)`      | `void`                         | Process a runtime event into the graph |

## Graph Structure

The graph captures:

- **Agent nodes** - Each agent execution (root and subagents)
- **Tool nodes** - Each tool call
- **Events** - All events that occurred during execution
- **Messages** - LLM messages stored in memory
- **Model info** - Model ID, provider, and usage statistics
- **Status** - Whether each node completed or failed

### Traversing the Graph

```typescript
const { stream, graph } = myAgent.run("Hello")

for await (const event of stream) {
  // ...
}

// graph.root is the ExecutionRootNode (entry point)
// graph.root.children[0] is typically the ExecutionAgentNode for the root agent
const agentNode = graph.root?.children[0]

if (agentNode?.type === "agent") {
  console.log(agentNode.name) // Agent name
  console.log(agentNode.input) // The prompt
  console.log(agentNode.status) // "completed" | "failed"
  console.log(agentNode.events) // All events
  console.log(agentNode.messages) // LLM messages
  console.log(agentNode.usage) // Accumulated token usage

  // Traverse children (tools and subagents)
  for (const child of agentNode.children) {
    if (child.type === "tool") {
      console.log(`Tool: ${child.name}`, child.input, child.output)
    } else if (child.type === "agent") {
      console.log(`Subagent: ${child.name}`)
    }
  }
}
```

## Node Types

All nodes share a common base with `id`, `status`, `children`, and `parent` fields.

### ExecutionRootNode

The entry point of the execution graph:

```typescript
interface ExecutionRootNode {
  type: "root"
  id: string
  name?: string
  status: NodeStatus
  error?: { message: string; stack?: string }
  children: ExecutionGraphNode[]
  parent: ExecutionGraphNode | null
}
```

### ExecutionAgentNode

Tracks agent execution, including model info and accumulated token usage:

```typescript
interface ExecutionAgentNode {
  type: "agent"
  id: string
  name?: string
  input?: unknown
  messages: ModelMessage[]
  events: AgentYield[]
  children: ExecutionGraphNode[]
  parent: ExecutionGraphNode | null
  status: NodeStatus // "pending" | "running" | "completed" | "failed"
  error?: { message: string; stack?: string }
  modelId?: string // Model used (e.g., "gpt-4o")
  provider?: string // Provider name (e.g., "openai")
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  thinking?: ThinkingConfig // Thinking/reasoning configuration if enabled
}
```

### ExecutionToolNode

Tracks tool execution:

```typescript
interface ExecutionToolNode {
  type: "tool"
  id: string // The tool call ID
  name?: string
  input?: unknown
  output?: unknown
  events: ToolYield[]
  children: ExecutionGraphNode[]
  parent: ExecutionGraphNode | null
  status: NodeStatus
  error?: { message: string; stack?: string }
}
```

### ExecutionGraphNode

Union of all node types:

```typescript
type ExecutionGraphNode = ExecutionRootNode | ExecutionAgentNode | ExecutionToolNode | ExecutionUnknownNode
```

## Persistence

Store the execution graph for later analysis:

```typescript
const { stream, graph } = myAgent.run("Analyze this document...")

for await (const event of stream) {
  // Process events
}

// Serialize the graph for database storage
await db.insert(agentRuns).values({
  id: generateId(),
  agentName: "document-analyzer",
  graph: JSON.stringify(graph.root),
  createdAt: new Date(),
})
```

## Use Cases

### 1. Debugging

Inspect the full execution tree:

```typescript
import type { ExecutionGraphNode } from "@gumbee/agent"

const { stream, graph } = myAgent.run("Complex task with tools")

for await (const event of stream) {
}

function printNode(n: ExecutionGraphNode, indent = 0) {
  const prefix = "  ".repeat(indent)
  console.log(`${prefix}[${n.type}] ${n.name}: ${n.status}`)

  for (const child of n.children) {
    printNode(child, indent + 1)
  }
}

const agentNode = graph.root?.children[0]
if (agentNode) printNode(agentNode)
// [agent] orchestrator: completed
//   [tool] search: completed
//   [agent] analyzer: completed
//     [tool] summarize: completed
//   [tool] format-output: completed
```

### 2. Cost Tracking

Agent nodes accumulate token usage automatically as the stream is consumed. For simple cases, read `usage` directly:

```typescript
const { stream, graph } = myAgent.run("Research task")

for await (const event of stream) {
}

const agentNode = graph.root?.children[0]
if (agentNode?.type === "agent" && agentNode.usage) {
  console.log(`Tokens: ${agentNode.usage.totalTokens}`)
  console.log(`Input: ${agentNode.usage.inputTokens}`)
  console.log(`Output: ${agentNode.usage.outputTokens}`)
}
```

For hierarchical agents, aggregate usage across the tree:

```typescript
function aggregateUsage(n: ExecutionGraphNode) {
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  // Add this node's usage if it's an agent
  if (n.type === "agent" && n.usage) {
    usage.inputTokens += n.usage.inputTokens
    usage.outputTokens += n.usage.outputTokens
    usage.totalTokens += n.usage.totalTokens
  }

  // Recurse into children
  for (const child of n.children) {
    const childUsage = aggregateUsage(child)
    usage.inputTokens += childUsage.inputTokens
    usage.outputTokens += childUsage.outputTokens
    usage.totalTokens += childUsage.totalTokens
  }

  return usage
}

const agentNode = graph.root?.children[0]
if (agentNode) {
  const totalUsage = aggregateUsage(agentNode)
  console.log(`Total tokens: ${totalUsage.totalTokens}`)
}
```

### 3. Event Path Tracking

Events include a `path` array showing the execution hierarchy, along with a `nodeId` for precise node identification:

```typescript
for await (const event of stream) {
  console.log(event.path, event.type)
  // ["orchestrator"] agent-begin
  // ["orchestrator"] agent-step-begin
  // ["orchestrator"] agent-step-llm-call
  // ["orchestrator"] tool-begin
  // ["orchestrator", "search"] tool-end
  // ["orchestrator"] agent-step-end
  // ...
}
```

The `path` helps you understand which agent or tool emitted each event in hierarchical agent setups. The `nodeId` field on agent events (and `toolCallId` on tool events) can be used with `graph.getNode(id)` to look up the corresponding node in the execution graph.
