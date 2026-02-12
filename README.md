# @gumbee/agent

<div align="left">

[![npm version](https://img.shields.io/npm/v/@gumbee/agent.svg)](https://www.npmjs.com/package/@gumbee/agent)
[![License](https://img.shields.io/npm/l/@gumbee/agent.svg)](package.json)

</div>

A powerful, composable agent framework built on the [Vercel AI SDK](https://sdk.vercel.ai/).

========================

<div align="left">
Related Documentation

[Agents](docs/agents.md) •
[Tools](docs/tools.md) •
[Memory](docs/memory.md) •
[Stop Conditions](docs/stop-conditions.md) •
[Context](docs/context.md) •
[Middleware](docs/middleware.md) •
[Tracing](docs/tracing.md)

</div>

## Features

- **Hierarchical Agents** — Agents can use other agents as tools, enabling complex multi-agent workflows
- **Typed Tools** — Define tools with Zod schemas for type-safe inputs and outputs
- **Middleware** — Composable middleware for fallbacks, logging, caching, and more
- **Rich Widgets** — Stream structured widget outputs for dynamic UI rendering
- **Execution Graph** — Full execution tracking for debugging and persistence
- **Provider Agnostic** — Works with OpenAI, Anthropic, Google, and any AI SDK provider
- **Observability** - Observability dashboard for debugging agents shipped with the @gumbee/agent package

</br>

---

</br>

![AgentDashboard](/docs/assets/AgentDashboardDemo0.gif)

## Installation

1. Install `@gumbee/agent` package and make sure peer dependency `ai` is installed as well

   ```bash
   bun add @gumbee/agent ai
   ```

2. Install any ai-sdk providers you'd like to use (check [Vercel docs](https://ai-sdk.dev/docs/introduction) for more info on the ai sdk)
   ```bash
   bun add @ai-sdk/openai # @ai-sdk/google @ai-sdk/anthropic
   ```

## Quick Start

```typescript
import { agent, tool, z } from "@gumbee/agent"
import { observability } from "@gumbee/agent/observability"
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

// Create an agent with observability enabled
const myAgent = agent({
  name: "assistant",
  description: "A helpful assistant",
  model: openai("gpt-4o"),
  system: "You are a helpful assistant.",
  tools: [searchTool],
  middlewares: [observability()],
})

// Run the agent
const { stream } = myAgent.run("What's the weather in Tokyo?")

for await (const event of stream) {
  if (event.type === "agent-stream" && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
}
```

Start the observability dashboard before running your agent:

```bash
# Start the observability dashboard server (default port: 4500)
bunx observe

# Open the dashboard in your browser at http://localhost:4500
```

## Development

For build information, check the `package.json` scripts.
This package is part of the Gumbee ecosystem of packages used by myself to build various personal projects and ideas.

To report bugs or submit patches please use [GitHub issues](https://github.com/gumbee/agent/issues).

## Releasing

This package uses [changesets](https://github.com/changesets/changesets) for version management and GitHub Actions for automated publishing.

### Creating a Changeset

When you make changes that should be released, create a changeset:

```bash
bun changeset
```

This will prompt you to:

1. Select the type of change (patch, minor, major)
2. Write a summary of the changes

Commit the generated changeset file (in `.changeset/`) with your changes.

### Publishing a Release

When ready to release:

```bash
# 1. Apply changesets to bump version and update CHANGELOG
bun run version

# 2. Commit the version bump
git add .
git commit -m "chore: release v1.x.x"

# 3. Create and push the tag
git tag v1.x.x
git push origin main --tags
```

The GitHub Actions workflow will automatically build and publish to npm when the tag is pushed.

## License

MIT
