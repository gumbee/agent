# @gumbee/agent

A powerful, composable agent framework built on the [Vercel AI SDK](https://sdk.vercel.ai/).

## Features

- **Hierarchical Agents** — Agents can use other agents as tools, enabling complex multi-agent workflows
- **Typed Tools** — Define tools with Zod schemas for type-safe inputs and outputs
- **Middleware** — Composable middleware for fallbacks, logging, caching, and more
- **Rich Widgets** — Stream structured widget outputs for dynamic UI rendering
- **Execution Graph** — Full execution tracking for debugging and persistence
- **Provider Agnostic** — Works with OpenAI, Anthropic, Google, and any AI SDK provider

## Installation

```bash
npm install @gumbee/agent ai
```

## Quick Start

```typescript
import { agent, tool, z } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

// Define a tool
const searchTool = tool({
  name: "search",
  description: "Search the web",
  input: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    return { results: await search(query) }
  },
})

// Create an agent
const myAgent = agent({
  name: "assistant",
  description: "A helpful assistant",
  model: openai("gpt-4o"),
  system: "You are a helpful assistant.",
  tools: [searchTool],
})

// Run the agent
const { stream } = myAgent.run("What's the weather in Tokyo?")

for await (const event of stream) {
  if (event.type === "agent-stream" && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
}
```

## Documentation

- [Agents](./docs/agents.md) — Creating and running agents
- [Execution Graph](./docs/tracing.md) — Tracking and debugging executions

## License

MIT
