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

Define tools with typed inputs and outputs:

```typescript
import { tool, z } from "@gumbee/agent"

const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a city",
  input: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }, context) => {
    const weather = await fetchWeather(city)
    return weather
  },
})
```

### Async Generator Tools

Tools can yield progress events:

```typescript
const processDataTool = tool({
  name: "process_data",
  description: "Process data with progress updates",
  input: z.object({
    data: z.string(),
  }),
  execute: async function* ({ data }, context) {
    // Yield progress events (emitted as tool-progress)
    yield { type: "progress", percent: 0 }

    await processStep1(data)
    yield { type: "progress", percent: 50 }

    const result = await processStep2(data)
    yield { type: "progress", percent: 100 }

    // Return the final result
    return { result }
  },
})
```

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
import { stopAfterSteps, stopOnFinish, stopOnToolCall, stopAny, stopAll, stopNever, DEFAULT_STOP_CONDITION } from "@gumbee/agent"

const myAgent = agent({
  // ...
  stopCondition: stopAny(
    stopAfterSteps(10), // Stop after 10 steps
    stopOnFinish(), // Stop when LLM finishes (no tool calls)
    stopOnToolCall("final_answer"), // Stop when this tool is called
  ),
})
```

### Custom Stop Conditions

```typescript
const customStop: StopCondition = ({ step, finishReason, messages }) => {
  // Stop if we've used too many messages
  if (messages.length > 50) return true

  // Stop after certain steps if finished
  if (step >= 2 && finishReason === "stop") return true

  return false
}
```

## Middleware

Middleware wraps agent and tool execution:

```typescript
import { Middleware, fallback } from "@gumbee/agent"

// Built-in fallback middleware
const myAgent = agent({
  name: "assistant",
  description: "An assistant with fallback",
  model: openai("gpt-4o"),
  middleware: [
    fallback({
      model: google("gemini-2.0-flash"),
      maxRetries: 2,
      shouldRetry: (error) => error.message.includes("rate limit"),
    }),
  ],
})

// Or add middleware at runtime
const { stream } = myAgent.run(prompt, context, {
  middleware: [loggingMiddleware()],
})
```

### Custom Middleware

```typescript
function loggingMiddleware(): Middleware {
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

Memory stores conversation history:

```typescript
import { SimpleMemory } from "@gumbee/agent"

// Create with initial messages
const memory = new SimpleMemory([
  { role: "user", content: [{ type: "text", text: "Hello" }] },
  { role: "assistant", content: [{ type: "text", text: "Hi there!" }] },
])

// Use as default memory
const myAgent = agent({
  // ...
  memory: memory,
})

// Or override per-run
const { stream } = myAgent.run("Continue our conversation", context, {
  memory: new SimpleMemory(previousMessages),
})
```

### Custom Memory

Implement the `Memory` interface for custom storage:

```typescript
interface Memory {
  read(): Promise<ModelMessage[]>
  store(message: ModelMessage): void | Promise<void>
  appended(): Promise<ModelMessage[]>
}
```

## Widgets

Enable rich UI responses with widgets:

```typescript
import { DescribeRegistry } from "@gumbee/structured"
import { agent, z } from "@gumbee/agent"

// Create widget registry
const registry = new DescribeRegistry()

// Register widget schemas
registry.register(
  z.object({
    type: z.literal("chart"),
    data: z.array(z.number()),
  }),
)

// Use in agent
const myAgent = agent({
  name: "assistant",
  description: "Assistant with rich UI",
  model: openai("gpt-4o"),
  widgets: registry,
  widgetsPickerModel: openai("gpt-4o-mini"), // Faster model for widget selection
})

// Stream widget updates
for await (const event of stream) {
  if (event.type === "widget-delta") {
    console.log(`Widget ${event.index}:`, event.widget)
  }
}
```
