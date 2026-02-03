# Execution Graph

Every agent execution creates an execution graph, capturing the full execution tree including tool calls, subagent executions, events, and messages.

## Accessing the Execution Graph

The execution graph is returned from `agent.run()`:

```typescript
const { stream, graph, node } = myAgent.run("Hello")

// Consume the stream
for await (const event of stream) {
  console.log(event)
}

// After streaming completes, access the execution graph
console.log(node.status) // "completed" | "failed"
console.log(node.events) // All events from this agent
```

## Graph Structure

The graph captures:

- **Agent nodes** - Each agent execution (root and subagents)
- **Tool nodes** - Each tool call
- **Events** - All events that occurred during execution
- **Messages** - LLM messages stored in memory
- **Timing** - Execution duration
- **Status** - Whether each node completed or failed

### Traversing the Graph

```typescript
import { serializeNode } from "@gumbee/agent"

const { stream, graph, node } = myAgent.run("Hello")

for await (const event of stream) {
  // ...
}

// graph is the RootExecutionNode (entry point)
// node is the AgentExecutionNode for the agent

console.log(node.name) // Agent name
console.log(node.input) // The prompt
console.log(node.status) // "completed" | "failed"
console.log(node.events) // All events
console.log(node.messages) // LLM messages

// Traverse children (tools and subagents)
for (const child of node.children) {
  if (child.type === "tool") {
    console.log(`Tool: ${child.name}`, child.input, child.output)
  } else if (child.type === "agent") {
    console.log(`Subagent: ${child.name}`)
  }
}

// Serialize for storage
const json = serializeNode(graph)
```

## Node Types

### RootExecutionNode

The entry point of the execution graph:

```typescript
type RootExecutionNode = {
  type: "root"
  children: ExecutionNode[]
}
```

### AgentExecutionNode

Tracks agent execution:

```typescript
type AgentExecutionNode = {
  type: "agent"
  name: string
  description: string
  input: unknown
  output?: unknown
  messages: ModelMessage[] // LLM messages
  events: RuntimeYield[] // All events
  children: ExecutionNode[] // Tools and subagents
  status: "pending" | "running" | "completed" | "failed"
  error?: Error
}
```

### ToolExecutionNode

Tracks tool execution:

```typescript
type ToolExecutionNode = {
  type: "tool"
  name: string
  description: string
  toolCallId: string
  input: unknown
  output?: unknown
  events: RuntimeYield[] // Tool events
  children: ExecutionNode[] // Nested calls
  status: "pending" | "running" | "completed" | "failed"
  error?: Error
}
```

## Serialization for Persistence

```typescript
import { serializeNode } from "@gumbee/agent"

const { stream, graph } = myAgent.run("Analyze this document...")

for await (const event of stream) {
  // Process events
}

// Convert to JSON for database storage
const json = serializeNode(graph)

// Store in your database
await db.insert(agentRuns).values({
  id: generateId(),
  agentName: "document-analyzer",
  graph: json,
  createdAt: new Date(),
})
```

## Use Cases

### 1. Database Persistence

Store execution graphs for later analysis:

```typescript
const { stream, graph } = myAgent.run("Analyze this document...")

for await (const event of stream) {
  // Process events
}

await db.insert(agentRuns).values({
  id: generateId(),
  agentName: "document-analyzer",
  graph: serializeNode(graph),
  createdAt: new Date(),
})
```

### 2. Debugging

Inspect the full execution tree:

```typescript
const { stream, graph, node } = myAgent.run("Complex task with tools")

for await (const event of stream) {
}

function printNode(n: ExecutionNode, indent = 0) {
  const prefix = "  ".repeat(indent)
  console.log(`${prefix}[${n.type}] ${n.name}: ${n.status}`)

  for (const child of n.children) {
    printNode(child, indent + 1)
  }
}

printNode(node)
// [agent] orchestrator: completed
//   [tool] search: completed
//   [agent] analyzer: completed
//     [tool] summarize: completed
//   [tool] format-output: completed
```

### 3. Cost Tracking

Aggregate usage across the execution tree:

```typescript
const { stream, node } = myAgent.run("Research task")

for await (const event of stream) {
}

function aggregateUsage(n: ExecutionNode): Usage {
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  // Find step-end events for usage
  for (const event of n.events) {
    if (event.type === "agent-step-end" && event.usage) {
      usage.inputTokens += event.usage.inputTokens
      usage.outputTokens += event.usage.outputTokens
      usage.totalTokens += event.usage.totalTokens
    }
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

const totalUsage = aggregateUsage(node)
console.log(`Total tokens: ${totalUsage.totalTokens}`)
```

### 4. Event Path Tracking

Events include a `path` array showing the execution hierarchy:

```typescript
for await (const event of stream) {
  console.log(event.path, event.type)
  // ["orchestrator"] agent-begin
  // ["orchestrator"] agent-step-begin
  // ["orchestrator"] tool-begin
  // ["orchestrator", "search"] tool-end
  // ["orchestrator"] agent-step-end
  // ...
}
```

The path helps you understand which agent or tool emitted each event in hierarchical agent setups.
