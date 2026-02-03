# Tracing

Every agent execution is automatically traced, capturing the full execution tree including tool calls, subagent executions, events, and messages.

## Automatic Tracing

Tracing is built into `agent.run()` - no setup required:

```typescript
const { stream, trace } = agent.run("Hello")

// Consume the stream
for await (const event of stream) {
  console.log(event)
}

// Get the trace after execution completes
const executionTrace = await trace
```

## The Execution Trace

The trace captures:

- **Agent nodes** - Each agent execution (root and subagents)
- **Tool nodes** - Each tool call
- **Events** - All events that occurred during execution
- **Messages** - LLM messages stored in memory
- **Timing** - Start/end times for each node
- **Status** - Whether each node completed or failed

### Trace Structure

```typescript
const trace = await agent.run("Hello").trace

// Get the root node
const root = trace.getRoot()
console.log(root.type) // "agent"
console.log(root.name) // Agent name
console.log(root.input) // The prompt
console.log(root.output) // Final output
console.log(root.status) // "complete" | "error"
console.log(root.events) // All events
console.log(root.messages) // LLM messages

// Get child nodes (tools and subagents)
const children = trace.getChildren(root.id)
for (const child of children) {
  if (child.type === "tool") {
    console.log(`Tool: ${child.name}`, child.input, child.output)
  } else if (child.type === "agent") {
    console.log(`Subagent: ${child.name}`)
  }
}
```

### Serialization for Persistence

```typescript
const trace = await agent.run("Hello").trace

// Convert to JSON for database storage
const json = trace.toJSON()

// Store in your database
await db.insert(traces).values({
  sessionId: "xxx",
  data: json,
})
```

## Node Types

### AgentExecutionNode

```typescript
type AgentExecutionNode = {
  type: "agent"
  id: string
  name: string
  description: string
  input: unknown
  output?: unknown
  agent: Agent // Reference to the agent instance
  messages: ModelMessage[] // LLM messages
  events: AgentEvent[]
  childIds: string[]
  status: "pending" | "running" | "complete" | "error"
  startTime: number
  endTime?: number
  error?: Error
}
```

### ToolExecutionNode

```typescript
type ToolExecutionNode = {
  type: "tool"
  id: string
  name: string
  description: string
  input: unknown
  output?: unknown
  tool: Tool // Reference to the tool instance
  events: AgentEvent[]
  childIds: string[]
  status: "pending" | "running" | "complete" | "error"
  startTime: number
  endTime?: number
  error?: Error
}
```

## Multiple Traces

Pass additional traces for live observability:

```typescript
import { HttpTrace } from "@gumbee/agent"

// HttpTrace sends events to the observability dashboard via HTTP
const httpTrace = new HttpTrace()

const { stream, trace } = agent.run(
  "Hello",
  undefined,
  { traces: [httpTrace] }, // Additional traces
)

// Both traces receive updates:
// - InMemoryTrace (returned as `trace`) for database persistence
// - HttpTrace for live dashboard
```

## HttpTrace for Live Observability

The `HttpTrace` class sends trace events to the observability dashboard server via HTTP. It's compatible with all environments including Cloudflare Workers.

### Basic Usage

```typescript
import { Agent, HttpTrace } from "@gumbee/agent"

const httpTrace = new HttpTrace()

const { stream } = agent.run("Analyze this data", undefined, {
  traces: [httpTrace],
})

for await (const event of stream) {
  // Events are automatically sent to the dashboard
}
```

### Configuration

```typescript
const httpTrace = new HttpTrace({
  url: "http://localhost:7667/api/trace", // Dashboard endpoint
  room: "my-traces", // Room name for grouping
  batch: true, // Batch events before sending
  batchInterval: 100, // Batch interval in ms
})
```

| Option          | Default                           | Description                    |
| --------------- | --------------------------------- | ------------------------------ |
| `url`           | `http://localhost:7667/api/trace` | HTTP endpoint of the dashboard |
| `room`          | `llm-traces`                      | Room name for grouping traces  |
| `batch`         | `false`                           | Whether to batch events        |
| `batchInterval` | `100`                             | Batch interval in milliseconds |

## AsyncLocalStorage Context

The trace context is managed via Node.js `AsyncLocalStorage`, automatically propagating through async operations:

```typescript
import { getTraceContext, addEventToTraces, addMessageToTraces } from "@gumbee/agent"

// Inside a tool or custom code running within agent context:
const ctx = getTraceContext()
if (ctx) {
  console.log("Current node:", ctx.currentNodeId)
  console.log("Active traces:", ctx.traces.length)

  // Add custom events
  addEventToTraces({ type: "custom", data: "..." })
}
```

### Context Helpers

| Function                       | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `getTraceContext()`            | Get current trace context (or undefined)       |
| `withTraceContext(ctx, fn)`    | Run function with trace context                |
| `addEventToTraces(event)`      | Add event to all active traces                 |
| `addMessageToTraces(message)`  | Add message to all active traces               |
| `startToolNode(tool, input)`   | Start a tool node, returns completion handle   |
| `startAgentNode(agent, input)` | Start an agent node, returns completion handle |
| `createChildContext(nodeId)`   | Create child context with new node ID          |
| `generateNodeId()`             | Generate a unique node ID (for custom traces)  |

## Use Cases

### 1. Database Persistence

Store traces for later analysis:

```typescript
const { stream, trace } = agent.run("Analyze this document...")

for await (const event of stream) {
  // Process events
}

const executionTrace = await trace
await db.insert(agentRuns).values({
  id: generateId(),
  agentName: "document-analyzer",
  trace: executionTrace.toJSON(),
  createdAt: new Date(),
})
```

### 2. Live Dashboard

Use the built-in dashboard for real-time observability:

```bash
# Start the dashboard
bunx @gumbee/observability dashboard
```

```typescript
import { Agent, HttpTrace } from "@gumbee/agent"

const trace = new HttpTrace()
const { stream } = agent.run("Task", undefined, { traces: [trace] })

for await (const event of stream) {
  // Events sync to dashboard in real-time
}

// Open http://localhost:7667 to see the trace
```

See **[@gumbee/observability](../../../observability/README.md)** for full dashboard documentation.

### 3. Debugging

Inspect the full execution tree:

```typescript
const { stream, trace } = agent.run("Complex task with tools")

for await (const event of stream) {
}

const t = await trace
const root = t.getRoot()!

function printNode(node: ExecutionNode, indent = 0) {
  const prefix = "  ".repeat(indent)
  console.log(`${prefix}[${node.type}] ${node.name}: ${node.status}`)

  for (const childId of node.childIds) {
    const child = t.getNode(childId)
    if (child) printNode(child, indent + 1)
  }
}

printNode(root)
// [agent] orchestrator: complete
//   [tool] search: complete
//   [agent] analyzer: complete
//     [tool] summarize: complete
//   [tool] format-output: complete
```

### 4. Cost Tracking

Aggregate usage across the execution tree:

```typescript
const { stream, trace } = agent.run("Research task")

for await (const event of stream) {
}

const t = await trace

function aggregateUsage(node: ExecutionNode): Usage {
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  // Find complete events for usage
  for (const event of node.events) {
    if (event.type === "complete" && event.usage) {
      usage.inputTokens += event.usage.inputTokens
      usage.outputTokens += event.usage.outputTokens
      usage.totalTokens += event.usage.totalTokens
    }
  }

  // Recurse into children
  for (const childId of node.childIds) {
    const child = t.getNode(childId)
    if (child) {
      const childUsage = aggregateUsage(child)
      usage.inputTokens += childUsage.inputTokens
      usage.outputTokens += childUsage.outputTokens
      usage.totalTokens += childUsage.totalTokens
    }
  }

  return usage
}

const totalUsage = aggregateUsage(t.getRoot()!)
console.log(`Total tokens: ${totalUsage.totalTokens}`)
```
