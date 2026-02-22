# @gumbee/agent Documentation

A powerful agent framework with built-in middleware, execution graphs, and rich widget support.

## Core Concepts

- **[Agents](./agents.md)** - Creating and running agents, configuration, and subagents
- **[Tools](./tools.md)** - Defining typed tools, using instructions, and async generators
- **[Memory](./memory.md)** - Managing conversation history and custom memory strategies
- **[Stop Conditions](./stop-conditions.md)** - Controlling when the agent loop terminates
- **[Context](./context.md)** - Application context, dynamic system prompts, and per-request data
- **[Middleware](./middleware.md)** - Composable middleware for logging, fallbacks, caching, and more
- **[Tracing](./tracing.md)** - Execution graph tracking for debugging and persistence
- **[Observability](./observability.md)** - Real-time dashboard for inspecting agent traces and events

## Quick Start

```typescript
import { agent, SimpleMemory } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

const myAgent = agent({
  name: "assistant",
  description: "A helpful assistant",
  model: openai("gpt-4o"),
  system: "You are a helpful assistant.",
})

const { stream } = myAgent.run("Hello, how are you?")

// Stream events
for await (const event of stream) {
  if (event.type === "agent-stream" && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
}
```

## Features

- **Execution Graph** - Every `agent.run()` creates an execution graph tracking the full execution tree
- **Tool Support** - Define custom tools with typed inputs/outputs using Zod schemas
- **Subagents** - Agents can use other agents as tools
- **Context Handoff** - Use `handoff(...)` to compose agents with incompatible context types
- **Middleware** - Composable middleware for logging, fallbacks, caching, and more
- **Rich Widgets** - Support for structured widget outputs in responses
- **Provider Options** - Configure provider-specific features like Claude thinking or OpenAI reasoning
