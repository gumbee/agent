# @gumbee/agent Documentation

A powerful agent framework with built-in observability and tracing.

## Core Concepts

- **[Agents](./agents.md)** - LLM-powered agents that can use tools and spawn subagents
- **[Tracing](./tracing.md)** - Automatic execution tracing for persistence and debugging
- **[Observability](./observability.md)** - Real-time dashboard for visualizing agent execution

## Quick Start

```typescript
import { Agent, SimpleMemory } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

const agent = new Agent({
  name: "assistant",
  description: "A helpful assistant",
  model: openai("gpt-4o"),
  system: "You are a helpful assistant.",
  memory: new SimpleMemory(),
})

const { stream, trace } = agent.run("Hello, how are you?")

// Stream events
for await (const event of stream) {
  if (event.type === "text") {
    process.stdout.write(event.text)
  }
}

// Get the execution trace for persistence
const executionTrace = await trace
console.log(executionTrace.toJSON())
```

## Features

- **Automatic Tracing** - Every `agent.run()` creates an execution trace
- **Tool Support** - Define custom tools with typed inputs/outputs
- **Subagents** - Agents can use other agents as tools
- **AsyncLocalStorage** - Trace context propagates automatically through async operations
- **Live Dashboard** - Built-in observability dashboard with real-time sync (`bunx @gumbee/agent dashboard`)
- **Multiple Traces** - Pass additional traces for live observability (HttpTrace)
