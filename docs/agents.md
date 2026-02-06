# Agents

Agents are LLM-powered entities that can reason, use tools, and spawn subagents to accomplish tasks.

## Creating an Agent

```typescript
import { agent, tool, SimpleMemory, z } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

const myAgent = agent({
  name: "research-assistant",
  description: "A research assistant that can search and analyze information",
  model: openai("gpt-4o"),
  system: "You are a research assistant. Use your tools to find and analyze information.",
  tools: [searchTool, analyzeTool],
})
```

## Configuration Options

| Option               | Type               | Description                                                    |
| -------------------- | ------------------ | -------------------------------------------------------------- |
| `name`               | `string`           | Required identifier for the agent                              |
| `description`        | `string`           | Required description shown to parent agents when used as tool  |
| `model`              | `LanguageModel`    | Required AI SDK language model to use                          |
| `system`             | `string \| fn`     | System prompt (string or function receiving context)           |
| `instructions`       | `string`           | Instructions used when agent runs as a subagent                |
| `tools`              | `Runner[]`         | Optional array of tools or agents the agent can use            |
| `memory`             | `Memory`           | Optional default memory implementation                         |
| `middleware`         | `Middleware[]`     | Optional array of middleware                                   |
| `stopCondition`      | `StopCondition`    | Optional condition for when to stop the agent loop             |
| `widgets`            | `DescribeRegistry` | Optional registry for rich widget outputs                      |
| `widgetsPickerModel` | `LanguageModel`    | Optional model for widget schema selection                     |
| `providerOptions`    | `object`           | Optional provider-specific options (e.g., thinking, reasoning) |

## Running an Agent

### Basic Usage

```typescript
const { stream } = myAgent.run("What is the weather in Tokyo?")

// Stream events
for await (const event of stream) {
  if (event.type === "agent-stream" && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
}
```

### With Application Context

Pass application-specific context that tools can access:

```typescript
type AppContext = {
  userId: string
  apiKey: string
}

const myAgent = agent<AppContext>({
  name: "user-assistant",
  description: "An assistant that helps users",
  model: openai("gpt-4o"),
  system: (context) => `You are helping user ${context.userId}`,
  // ...
})

const { stream } = myAgent.run("Find my orders", { userId: "123", apiKey: "xxx" })
```

### With Run Configuration

```typescript
const controller = new AbortController()

const { stream, graph, node } = myAgent.run("Long running task", context, {
  memory: new SimpleMemory(previousMessages), // Override default memory
  abort: controller.signal, // Cancellation signal
  middleware: [loggingMiddleware], // Additional middleware
})

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000)

// After streaming, access execution state
for await (const event of stream) {
  // ...
}

console.log(node.status) // "completed" | "failed"
```

### Run Return Values

The `run()` method returns:

| Property  | Type                 | Description                            |
| --------- | -------------------- | -------------------------------------- |
| `stream`  | `AsyncGenerator`     | Stream of runtime events               |
| `memory`  | `Memory`             | Memory instance used for this run      |
| `graph`   | `RootExecutionNode`  | Root of the execution graph            |
| `node`    | `AgentExecutionNode` | Getter for the agent's execution node  |
| `context` | `AgentLoopContext`   | Getter for agent context (model, etc.) |

## Event Types

The stream yields various event types:

```typescript
for await (const event of stream) {
  switch (event.type) {
    // Agent lifecycle
    case "agent-begin":
      console.log("Agent started:", event.path)
      break

    case "agent-end":
      console.log("Agent finished:", event.path)
      break

    // Step lifecycle
    case "agent-step-begin":
      console.log(`Step ${event.step} starting`)
      break

    case "agent-step-end":
      console.log(`Step ${event.step} finished:`, event.finishReason)
      break

    // Streaming text
    case "agent-stream":
      if (event.part.type === "text-delta") {
        process.stdout.write(event.part.textDelta)
      }
      break

    // Tool events
    case "tool-begin":
      console.log(`Calling ${event.tool} with`, event.input)
      break

    case "tool-end":
      console.log(`${event.tool} returned`, event.output)
      break

    case "tool-progress":
      console.log(`${event.tool} progress:`, event.event)
      break

    case "tool-error":
      console.error(`${event.tool} failed:`, event.error)
      break

    // Widget updates
    case "widget-delta":
      console.log(`Widget ${event.index}:`, event.widget)
      break

    // Errors
    case "agent-error":
      console.error("Agent error:", event.error)
      break
  }
}
```

### Type Guards

Use built-in type guards for type-safe event handling:

```typescript
import {
  isAgentBegin,
  isAgentEnd,
  isAgentStepBegin,
  isAgentStepEnd,
  isAgentStream,
  isToolBegin,
  isToolEnd,
  isToolError,
  isWidgetDelta,
} from "@gumbee/agent"

for await (const event of stream) {
  if (isAgentStream(event) && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
  if (isToolBegin(event)) {
    console.log(`Tool ${event.tool} started`)
  }
}
```

## Tools

Define tools with typed inputs and outputs. Tools support an `instructions` field that is dynamically injected into the agent's system prompt at runtime.

```typescript
import { tool, z } from "@gumbee/agent"

const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a city",
  instructions: "Use this tool when the user asks about weather. Always include the unit.",
  input: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }, context) => {
    const weather = await fetchWeather(city)
    return weather
  },
})
```

For full documentation on tools, including async generator tools with progress events, the `instructions` field, and tool context, see [Tools](./tools.md).

## Subagents

Agents can use other agents as tools:

```typescript
const researchAgent = agent({
  name: "researcher",
  description: "Researches topics in depth",
  instructions: "Research the given topic thoroughly and return findings",
  model: openai("gpt-4o"),
  tools: [searchTool, readTool],
})

const writerAgent = agent({
  name: "writer",
  description: "Writes articles based on research",
  instructions: "Write a well-structured article based on the provided research",
  model: openai("gpt-4o"),
})

const orchestratorAgent = agent({
  name: "orchestrator",
  description: "Coordinates research and writing",
  model: openai("gpt-4o"),
  tools: [researchAgent, writerAgent], // Agents as tools!
})

// The orchestrator can delegate to subagents
const { stream } = orchestratorAgent.run("Write an article about AI agents")

for await (const event of stream) {
  // Events from subagents include their path: ["orchestrator", "researcher"]
  console.log(event.path, event.type)
}
```

## Stop Conditions

Control when the agent loop terminates:

```typescript
import { stopAfterSteps, stopOnFinish, stopOnToolCall, stopAny } from "@gumbee/agent"

const myAgent = agent({
  // ...
  stopCondition: stopAny(
    stopAfterSteps(10), // Stop after 10 steps
    stopOnFinish(), // Stop when LLM finishes (no tool calls)
    stopOnToolCall("final_answer"), // Stop when this tool is called
  ),
})
```

For full documentation on stop conditions, including all built-in conditions, combinators, defaults, and custom stop conditions, see [Stop Conditions](./stop-conditions.md).

## Middleware

Middleware wraps agent and tool execution. For full documentation on middleware, including all handler types, propagation, and custom middleware, see [Middleware](./middleware.md).

```typescript
import { Middleware, fallback } from "@gumbee/agent"

// Built-in fallback middleware
const myAgent = agent({
  name: "assistant",
  description: "An assistant with fallback",
  model: openai("gpt-4o"),
  middleware: [
    // fallback to anthropic if gemini flash fails a step
    fallback({ model: anthropic("claude-sonnet-4-20250514") }),
    // fallback to gemini flash model if gpt-4o fails a step
    fallback({ model: google("gemini-2.5-flash") }),
  ],
})

// Or add middleware at runtime
const { stream } = myAgent.run(prompt, context, {
  middleware: [logging()],
})
```

### Custom Middleware

```typescript
function logging(): Middleware {
  return {
    handleAgent(c, next) {
      console.log("Agent starting:", c.prompt)
      const result = next(c)
      return result
    },
    handleTool(c, next) {
      console.log("Tool starting:", c.tool.name)
      return next(c)
    },
    shouldDescendIntoAgent: (agent) => true, // Apply to sub-agents
    shouldDescendIntoTool: (tool) => true, // Apply to tools
  }
}
```

## Provider Options

Configure provider-specific features:

```typescript
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google"
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai"

const myAgent = agent({
  name: "thinking-agent",
  description: "An agent that thinks deeply",
  model: openai("gpt-4o"),
  providerOptions: {
    google: {
      thinkingConfig: {
        thinkingBudget: 10000,
      },
    } satisfies GoogleGenerativeAIProviderOptions,
    openai: {
      reasoningEffort: "high",
    } satisfies OpenAIResponsesProviderOptions,
  },
})
```

## Memory

Memory stores conversation history and tracks messages added during a run:

```typescript
import { SimpleMemory } from "@gumbee/agent"

// Create with initial messages
const memory = new SimpleMemory([
  { role: "user", content: [{ type: "text", text: "Hello" }] },
  { role: "assistant", content: [{ type: "text", text: "Hi there!" }] },
])

const myAgent = agent({
  // ...
  memory: memory,
})
```

For full documentation on memory, including the `Memory` interface, what `appended()` returns, and custom memory strategies (e.g., auto-summarizing memory), see [Memory](./memory.md).

## Widgets

Enable rich UI responses with widgets. Widgets are registered using a `DescribeRegistry` and the `.add()` method, which takes a Zod schema and a metadata object:

```typescript
import { DescribeRegistry, z } from "@gumbee/structured"
import { agent } from "@gumbee/agent"

// Define widget schemas
const ChartWidget = z.object({
  type: z.literal("chart"),
  data: z.array(z.number()),
  title: z.string().optional().describe("Chart title"),
})

const SummaryWidget = z.object({
  type: z.literal("summary"),
  text: z.string().describe("The summary content. Supports markdown."),
})

// Create registry and add widgets using .add(schema, meta)
// .add() returns `this` so calls can be chained
const registry = new DescribeRegistry()
  .add(ChartWidget, {
    id: "Chart",
    description: "Display a data chart with numeric values",
  })
  .add(SummaryWidget, {
    id: "Summary",
    description: "Display a summary card",
    always: true, // Always include this widget in output
  })

// Use in agent
const myAgent = agent({
  name: "assistant",
  description: "Assistant with rich UI",
  model: openai("gpt-4o"),
  widgets: registry,
  widgetsPickerModel: openai("gpt-4o-mini"), // Faster model for widget selection
})

// Stream widget updates
const { stream } = myAgent.run("Show me the quarterly data")

for await (const event of stream) {
  if (event.type === "widget-delta") {
    console.log(`Widget ${event.index}:`, event.widget)
  }
}
```

### Widget Metadata Options

The second argument to `.add()` is a `DescribeMeta` object:

| Option         | Type       | Description                                                                                |
| -------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `id`           | `string`   | Required unique identifier for the widget                                                  |
| `description`  | `string`   | Human-readable description (helps the LLM pick widgets)                                    |
| `aliases`      | `string[]` | Alternative names that can reference this widget                                           |
| `always`       | `boolean`  | If true, always include this widget in typescript definition passed to LLM                 |
| `utility`      | `boolean`  | If true, this is a utility type (referenced by others, but not used as top-level widget)   |
| `dependencies` | `string[]` | list of widgets to always be included in typescript definition if this widget is included  |
| `rules`        | `string`   | Additional rules/constraints for LLM prompts. Included as comment in typescript definition |

### Utility Types

You can register shared sub-schemas as utility types that are referenced by other widgets but not exported as top-level widget types:

```typescript
const Symptom = z.object({
  name: z.string().describe("The symptom name"),
  bodyPart: z.enum(["head", "chest", "abdomen", "limbs"]).describe("Affected area"),
})

const SymptomListWidget = z.object({
  type: z.literal("symptom_list"),
  symptoms: Symptom.array().describe("List of symptoms"),
})

const registry = new DescribeRegistry()
  .add(Symptom, {
    id: "Symptom",
    utility: true, // Won't appear as a top-level widget type
  })
  .add(SymptomListWidget, {
    id: "SymptomList",
    description: "Display a list of symptoms with affected body areas",
  })
```
