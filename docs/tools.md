# Tools

Tools are typed, executable units of work that agents can call. They define a name, description, input schema, and an execute function.

## Creating a Tool

```typescript
import { tool, z } from "@gumbee/agent"

const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a city",
  input: z.object({
    city: z.string().describe("City name"),
    unit: z.enum(["celsius", "fahrenheit"]).optional().describe("Temperature unit"),
  }),
  execute: async ({ city, unit }) => {
    const weather = await fetchWeather(city, unit)
    return weather
  },
})
```

## Configuration Options

| Option         | Type                                                         | Description                                              |
| -------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `name`         | `string`                                                     | Required identifier for the tool                         |
| `description`  | `string`                                                     | Required description shown to the LLM                    |
| `instructions` | `string`                                                     | Optional instructions injected into the system prompt    |
| `input`        | `z.ZodSchema`                                                | Required Zod schema defining the tool's input parameters |
| `execute`      | `(input, context, env) => Promise<Output> \| AsyncGenerator` | Required execution function                              |

## The `instructions` Field

The `instructions` field is a powerful feature that allows tools to dynamically contribute to the agent's system prompt. When an agent has tools with `instructions`, those instructions are automatically collected and appended to the base system prompt at runtime.

### How It Works

At each step of the agent loop, the system prompt is constructed as follows:

1. The agent's base `system` prompt is resolved (string or function)
2. All tools' `instructions` fields are collected (filtering out any that are undefined)
3. They are joined together with double newlines and appended after the base system prompt

```
[Base system prompt]

[Tool 1 instructions]

[Tool 2 instructions]

...
```

### Example

```typescript
const searchTool = tool({
  name: "search",
  description: "Search the web for information",
  instructions: `When using the search tool:
- Formulate clear, specific search queries
- Prefer recent results when the topic is time-sensitive
- Always cite the source URL in your response`,
  input: z.object({
    query: z.string().describe("Search query"),
  }),
  execute: async ({ query }) => {
    return await search(query)
  },
})

const calculatorTool = tool({
  name: "calculate",
  description: "Perform mathematical calculations",
  instructions: `When using the calculator:
- Break complex calculations into steps
- Show your work when explaining results to the user`,
  input: z.object({
    expression: z.string().describe("Mathematical expression to evaluate"),
  }),
  execute: async ({ expression }) => {
    return eval(expression)
  },
})

const myAgent = agent({
  name: "assistant",
  description: "A helpful assistant",
  model: openai("gpt-4o"),
  system: "You are a helpful assistant.",
  tools: [searchTool, calculatorTool],
})
```

The effective system prompt at runtime would be:

```
You are a helpful assistant.

When using the search tool:
- Formulate clear, specific search queries
- Prefer recent results when the topic is time-sensitive
- Always cite the source URL in your response

When using the calculator:
- Break complex calculations into steps
- Show your work when explaining results to the user
```

This means each tool can carry its own usage guidelines, and they are automatically included when the tool is available to the agent.

## Type Safety

Both `tool()` and `agent()` use generics:

```typescript
tool<Context, TSchema extends z.ZodSchema, Output, CustomYields>(config)
agent<Context, Input = string | UserModelMessage, Output = { response: string }>(config)
```

For `tool()`, none of the generic parameters have defaults. This means you cannot pass partial generics -- TypeScript requires either all four or none. For `agent()`, `Context` has no default while `Input` and `Output` do, so `agent<MyContext>()` compiles but prevents `Input` and `Output` from being inferred from your config.

In both cases, the recommended approach is to **let TypeScript infer everything** and provide type hints through parameter annotations instead of explicit generics:

```typescript
type AppContext = {
  userId: string
  db: Database
}

// Good -- no generics, context typed via parameter annotation
const getUserOrders = tool({
  name: "get_orders",
  description: "Get orders for the current user",
  input: z.object({
    limit: z.number().optional().describe("Max number of orders to return"),
  }),
  execute: async ({ limit }, context: AppContext) => {
    // `limit` is correctly inferred as `number | undefined`
    // `context` is typed as AppContext
  },
})
```

This works because TypeScript infers `TSchema` from the `input` field and `Output` from the return type of `execute`, while the context type is provided inline through the parameter annotation.

The same principle applies to agents:

```typescript
// Good -- input type inferred from schema, context typed via parameter
const myAgent = agent({
  name: "analyzer",
  model: openai("gpt-4o"),
  input: z.object({ query: z.string() }),
  toPrompt: (input) => input.query, // `input` inferred as { query: string }
  async *execute(run, input, context: AppContext, env) {
    // `input` inferred from schema, `context` typed via annotation
  },
})
```

## Execute Function

The `execute` function receives three arguments:

| Argument  | Type                 | Description                                                        |
| --------- | -------------------- | ------------------------------------------------------------------ |
| `input`   | Inferred from schema | The parsed and validated input                                     |
| `context` | `Context`            | Application context passed to `agent.run()`                        |
| `env`     | `RunnerEnvironment`  | Runtime environment with `abort` signal, `toolCallId`, and `runId` |

### Using Context

Tools can access application-specific context passed when running the agent. Type context through parameter annotations (see [Type Safety](#type-safety)):

```typescript
type AppContext = {
  userId: string
  db: Database
}

const getUserOrders = tool({
  name: "get_orders",
  description: "Get orders for the current user",
  input: z.object({
    limit: z.number().optional().describe("Max number of orders to return"),
  }),
  execute: async ({ limit }, { db, userId }: AppContext) => {
    const orders = await db.orders.findMany({
      where: { userId },
      take: limit ?? 10,
    })
    return orders
  },
})
```

### Using the Environment

The `env` object provides runtime utilities:

```typescript
const longRunningTool = tool({
  name: "process",
  description: "Process a large dataset",
  input: z.object({ datasetId: z.string() }),
  execute: async ({ datasetId }, context, env) => {
    // Check if the agent run has been aborted
    if (env.abort?.aborted) {
      throw new Error("Operation cancelled")
    }

    // Access the unique tool call ID (unique per tool/agent) and run ID (shared across tools/agents per run)
    console.log("Tool call ID:", env.toolCallId)
    console.log("Run ID:", env.runId)

    const result = await processDataset(datasetId, { signal: env.abort })
    return result
  },
})
```

## Async Generator Tools

Tools can be implemented as async generators to yield progress events during execution. These events are emitted as `tool-progress` events in the stream.

```typescript
const processDataTool = tool({
  name: "process_data",
  description: "Process data with progress updates",
  input: z.object({
    data: z.string(),
  }),
  execute: async function* ({ data }, context) {
    yield { type: "progress", percent: 0, message: "Starting..." }

    await processStep1(data)
    yield { type: "progress", percent: 50, message: "Halfway done..." }

    const result = await processStep2(data)
    yield { type: "progress", percent: 100, message: "Complete" }

    // The return value is the tool's output
    return { result }
  },
})
```

Progress events can be any shape -- they are forwarded as-is in the `tool-progress` event:

```typescript
for await (const event of stream) {
  if (event.type === "tool-progress") {
    console.log(`${event.tool} progress:`, event.event)
    // e.g., { type: "progress", percent: 50, message: "Halfway done..." }
  }
}
```

## Subagents as Tools

Agents can be used as tools for other agents. By default, the parent agent passes a `string | UserModelMessage` input to the subagent, and the subagent's `instructions` field is used as the tool description (helping the parent agent decide when to delegate).

```typescript
const researchAgent = agent({
  name: "researcher",
  description: "Researches topics in depth",
  instructions: "Research the given topic thoroughly using search. Return a structured summary.",
  model: openai("gpt-4o"),
  tools: [searchTool],
})

const orchestrator = agent({
  name: "orchestrator",
  description: "Coordinates work across specialized agents",
  model: openai("gpt-4o"),
  tools: [researchAgent, writerAgent], // Agents used as tools
})
```

### Custom Input Schemas

Subagents can define a custom `input` schema for structured input from the parent agent. When using a custom input type, provide a `toPrompt` function to map the structured input to a prompt for the LLM:

```typescript
const analysisAgent = agent({
  name: "analyzer",
  description: "Analyzes data with specific parameters",
  instructions: "Analyze the provided data according to the given parameters.",
  model: openai("gpt-4o"),
  input: z.object({
    data: z.string().describe("The data to analyze"),
    format: z.enum(["summary", "detailed"]).describe("Output format"),
  }),
  toPrompt: (input) => `Analyze this data (format: ${input.format}):\n${input.data}`,
  tools: [chartTool],
})
```

When `Input` is the default `string | UserModelMessage`, no `toPrompt` is needed -- the input is passed directly to the LLM.

See the [Agents documentation](./agents.md#subagents) for more details on subagent patterns.
