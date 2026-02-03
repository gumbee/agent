# Agents

Agents are LLM-powered entities that can reason, use tools, and spawn subagents to accomplish tasks.

## Creating an Agent

```typescript
import { Agent, SimpleMemory, Tool, defineTool, z } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

const agent = new Agent({
  name: "research-assistant",
  description: "A research assistant that can search and analyze information",
  model: openai("gpt-4o"),
  system: "You are a research assistant. Use your tools to find and analyze information.",
  memory: new SimpleMemory(),
  tools: [searchTool, analyzeTool],
})
```

## Configuration Options

| Option          | Type               | Description                                            |
| --------------- | ------------------ | ------------------------------------------------------ |
| `name`          | `string`           | Unique identifier for the agent                        |
| `description`   | `string`           | Description shown to parent agents when used as a tool |
| `model`         | `LanguageModel`    | The AI SDK language model to use                       |
| `system`        | `string`           | System prompt for the agent                            |
| `memory`        | `Memory`           | Memory implementation for conversation history         |
| `tools`         | `ToolLike[]`       | Optional array of tools the agent can use              |
| `stopCondition` | `StopCondition`    | Optional condition for when to stop the agent loop     |
| `widgets`       | `DescribeRegistry` | Optional registry for rich widget outputs              |

## Running an Agent

### Basic Usage

```typescript
const { stream, text, trace } = agent.run("What is the weather in Tokyo?")

// Option 1: Stream events
for await (const event of stream) {
  console.log(event)
}

// Option 2: Get final text
const response = await text
console.log(response)

// Option 3: Get full response with usage
const fullResponse = await agent.run("Hello").response
console.log(fullResponse.text, fullResponse.usage)
```

### With Application Context

Pass application-specific context that tools can access:

```typescript
type AppContext = {
  userId: string
  apiKey: string
}

const agent = new Agent<AppContext>({
  name: "user-assistant",
  // ...
})

const { stream } = agent.run("Find my orders", { userId: "123", apiKey: "xxx" })
```

### With Run Configuration

```typescript
const controller = new AbortController()

const { stream, trace } = agent.run(
  "Long running task",
  undefined, // context
  {
    abortSignal: controller.signal,
    traces: [httpTrace], // Additional traces for live observability
  },
)

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000)
```

## Event Types

The stream yields various event types:

```typescript
for await (const event of stream) {
  switch (event.type) {
    case "text":
      // Text chunk from the LLM
      console.log(event.text)
      break

    case "step":
      // Agent loop iteration
      console.log(`Step ${event.step}`)
      break

    case "tool":
      // Tool execution event (start, yield, complete, error)
      if (event.event === "start") {
        console.log(`Calling ${event.toolName} with`, event.input)
      } else if (event.event === "complete") {
        console.log(`${event.toolName} returned`, event.output)
      }
      break

    case "complete":
      // Agent finished
      console.log(`Completed in ${event.totalSteps} steps`)
      break

    case "error":
      // Error occurred
      console.error(event.error)
      break
  }
}
```

## Tools

Define tools with typed inputs and outputs:

```typescript
const weatherTool = defineTool({
  name: "get-weather",
  description: "Get current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async function* (input, context) {
    // Yield progress events
    yield { status: "fetching" }

    const weather = await fetchWeather(input.city)

    // Return the result
    return weather
  },
})
```

## Subagents

Agents can use other agents as tools:

```typescript
const researchAgent = new Agent({
  name: "researcher",
  description: "Researches topics in depth",
  // ...
})

const writerAgent = new Agent({
  name: "writer",
  description: "Writes articles based on research",
  // ...
})

const orchestratorAgent = new Agent({
  name: "orchestrator",
  description: "Coordinates research and writing",
  tools: [researchAgent, writerAgent], // Agents as tools!
  // ...
})

// The orchestrator can delegate to subagents
const { stream } = orchestratorAgent.run("Write an article about AI agents")

for await (const event of stream) {
}
```

## Stop Conditions

Control when the agent loop terminates:

```typescript
import { stopAfterSteps, stopOnFinish, stopOnToolCall, stopAny } from "@gumbee/agent"

const agent = new Agent({
  // ...
  stopCondition: stopAny(
    stopAfterSteps(10), // Stop after 10 steps
    stopOnFinish(), // Stop when LLM says "stop"
    stopOnToolCall("final-answer"), // Stop when this tool is called
  ),
})
```
