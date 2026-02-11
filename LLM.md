# LLM Guide: Building Agents with `@gumbee/agent`

This document is the practical reference for coding agents using `@gumbee/agent`.

It focuses on:

- How to build, run, and compose agents
- How to define tools and subagents
- How to stream events and wire frontend UX
- How to use middleware, memory, widgets, and execution graphs
- Real usage patterns from this repository

---

## 1) Quick Start

```ts
import { agent } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

const assistant = agent({
  name: "assistant",
  description: "Helpful assistant",
  model: openai("gpt-4o"),
  system: "You are a helpful assistant.",
})

const { stream } = assistant.run("Explain event streaming briefly.", {})

for await (const event of stream) {
  if (event.type === "agent-stream" && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
}
```

---

## 2) Installation

```bash
npm install @gumbee/agent ai
```

Install at least one model provider SDK:

```bash
npm install @ai-sdk/openai
# or
npm install @ai-sdk/google
# or
npm install @ai-sdk/anthropic
```

---

## 3) Core Mental Model

`@gumbee/agent` revolves around **runners**:

- **Agent runner**: reasons, calls tools, can delegate to subagents
- **Tool runner**: executes typed logic with validated input

When you call `agent.run(...)`, you get an **event stream** (`RuntimeYield`) that includes:

- Lifecycle (`agent-begin`, `agent-end`, step events)
- Token stream (`agent-stream`)
- Tool activity (`tool-begin`, `tool-progress`, `tool-end`, `tool-error`)
- Widget updates (`widget-delta`) when using a widget registry
- Middleware custom events (if any)

The same stream can drive:

- Server-side logs and telemetry
- SSE responses to clients
- Execution graph tracing

---

## 4) Creating Agents

### Minimal agent

```ts
import { agent } from "@gumbee/agent"
import { google } from "@ai-sdk/google"

const weatherAgent = agent({
  name: "weather-agent",
  description: "Answers weather questions",
  model: google("gemini-2.5-flash-preview-09-2025"),
  system: "You are a concise weather assistant.",
})
```

### Agent config options you will use most

- `name` (required): unique identifier
- `description` (required): shown when used as a tool by parent agents
- `model` (required): AI SDK language model
- `system`: string or `(context) => string | Promise<string>`
- `tools`: array of tools and/or agents
- `memory`: default memory implementation
- `middleware`: cross-cutting behavior
- `stopCondition`: controls loop termination
- `widgets`: widget schema registry
- `widgetsPickerModel`: optional picker model for widget schema selection
- `providerOptions`: provider-specific options
- `input` + `toPrompt`: structured input support for subagent use
- `execute`: override execution flow (advanced)
- `instructions`: guidance when this agent is called as a subagent tool

### Context-aware agent

```ts
import { agent } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

type AppContext = {
  userId: string
  timezone: string
}

const personalAssistant = agent<AppContext>({
  name: "personal-assistant",
  description: "User-aware assistant",
  model: openai("gpt-4o"),
  system: (ctx) => `You are helping user ${ctx.userId}. Local timezone: ${ctx.timezone}.`,
})
```

---

## 5) Running Agents and Consuming Streams

```ts
const controller = new AbortController()

const { stream, graph, context, memory } = personalAssistant.run(
  "Give me a 3-step study plan.",
  { userId: "u_123", timezone: "Asia/Karachi" },
  { abort: controller.signal },
)

for await (const event of stream) {
  if (event.type === "agent-stream" && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
}

const finalContext = await context
const allMessages = await memory.read()
const rootNode = graph.root
```

### `run()` returns

- `stream`: async generator of runtime events
- `graph`: execution graph updated as events are consumed
- `memory`: memory instance used for the run
- `context`: resolves to loop context after stream completion
- `abort`: abort signal used internally

### Useful event handling pattern

```ts
import { isAgentStream, isToolBegin, isToolEnd, isToolError, isWidgetDelta, isAgentStepLLMCall } from "@gumbee/agent"

for await (const event of stream) {
  if (isAgentStream(event) && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
  if (isToolBegin(event)) console.log("tool begin:", event.tool)
  if (isToolEnd(event)) console.log("tool end:", event.tool)
  if (isToolError(event)) console.error("tool error:", event.tool, event.error)
  if (isWidgetDelta(event)) console.log("widget delta:", event.index, event.widget)
  if (isAgentStepLLMCall(event)) console.log("model:", event.modelId, "provider:", event.provider)
}
```

### Real-world SSE bridge (backend route pattern)

```ts
for await (const event of stream) {
  await s.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  })
}
```

Used in:

- internal backend rich-chat route handlers

---

## 6) Defining Tools

Tools are typed with Zod input schemas and can return plain values or async generator yields.

### Standard tool

```ts
import { tool, z } from "@gumbee/agent"

const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a city",
  instructions: "Use this when user asks for weather. Include unit explicitly.",
  input: z.object({
    city: z.string(),
    unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  }),
  async execute({ city, unit }) {
    return { city, unit, temp: 27, conditions: "clear" }
  },
})
```

### Tool execute signature

`execute(input, context, env)` receives:

- `input`: parsed/validated input
- `context`: app context passed to `run()`
- `env`: runner metadata (`abort`, `toolCallId`, `runId`)

### Async generator tool (progress events)

```ts
const longTool = tool({
  name: "long_task",
  description: "Performs a long task with progress",
  input: z.object({ task: z.string() }),
  async *execute({ task }) {
    yield { type: "progress", message: `Starting: ${task}` }
    await new Promise((r) => setTimeout(r, 250))
    yield { type: "progress", message: "Halfway" }
    await new Promise((r) => setTimeout(r, 250))
    return { done: true }
  },
})
```

---

## 7) Subagents (Agents as Tools)

Any agent can be placed in another agent’s `tools` array.

### Basic delegation

```ts
const researcher = agent({
  name: "researcher",
  description: "Finds technical details",
  instructions: "Research deeply and return concise findings.",
  model: openai("gpt-4o"),
  tools: [weatherTool],
})

const writer = agent({
  name: "writer",
  description: "Writes polished summaries",
  instructions: "Write clear output from provided research.",
  model: openai("gpt-4o"),
})

const orchestrator = agent({
  name: "orchestrator",
  description: "Coordinates specialists",
  model: openai("gpt-4o"),
  tools: [researcher, writer],
})
```

### Structured subagent input

Use `input` + `toPrompt` when the subagent should accept a structured object.

```ts
import { z } from "@gumbee/agent"

const taskInput = z.object({
  title: z.string(),
  details: z.string(),
})

type TaskInput = z.infer<typeof taskInput>

const planner = agent({
  name: "planner",
  description: "Creates implementation plans",
  model: openai("gpt-4o"),
  input: taskInput,
  toPrompt: (input: TaskInput) => `Task: ${input.title}\n\nDetails:\n${input.details}`,
})
```

---

## 8) Memory

Memory controls conversation state.

### Memory interface

```ts
interface Memory {
  read(): Promise<ModelMessage[]>
  store(message: ModelMessage): void | Promise<void>
  appended(): Promise<ModelMessage[]>
}
```

### Built-in memory implementations

- `SimpleMemory`: keeps all messages
- `SlidingWindowMemory`: keeps most recent N messages (default 30), preserves tool-call/result coherence
- `TokenWindowMemory`: keeps most recent messages under a token budget (default 128000)

### Practical usage

```ts
import { agent, SimpleMemory, SlidingWindowMemory, TokenWindowMemory } from "@gumbee/agent"

const withSimple = new SimpleMemory()
const withWindow = new SlidingWindowMemory([], { windowSize: 20 })
const withTokenWindow = new TokenWindowMemory([], { maxTokens: 64000 })

const a = agent({ name: "a", description: "x", model: openai("gpt-4o"), memory: withWindow })
```

If no memory is passed, a SimpleMemory is created internally and used as default.

---

## 9) Stop Conditions

Stop conditions end the step loop.

```ts
import { stopAfterSteps, stopOnFinish, stopOnToolCall, stopAny, stopAll, DEFAULT_STOP_CONDITION } from "@gumbee/agent"

const customStop = stopAny(stopAfterSteps(12), stopOnFinish(), stopOnToolCall("final_answer"))
```

- `stopAfterSteps(n)`: hard step cap
- `stopOnFinish()`: stop when model is done and not requesting tool calls
- `stopOnToolCall(name)`: stop on specific tool call
- `stopAny(...)`: OR combinator
- `stopAll(...)`: AND combinator

Default:

- `DEFAULT_STOP_CONDITION` = `stopAny(stopAfterSteps(30), stopOnFinish())`

---

## 10) Middleware

Middleware wraps execution at 3 levels:

- `handleAgent`: full run lifecycle
- `handleTool`: each tool invocation
- `handleAgentStep`: each LLM step

### Middleware skeleton

```ts
import type { Middleware } from "@gumbee/agent"

function logging(): Middleware {
  return {
    async *handleAgent(c, next) {
      console.log("agent start")
      const result = yield* next(c)
      console.log("agent end")
      return result
    },
    async *handleTool(c, next) {
      console.log("tool", c.tool.name)
      return yield* next(c)
    },
    async *handleAgentStep(c, next) {
      console.log("step", c.step, c.model.modelId)
      return yield* next(c)
    },
    shouldDescendIntoAgent: () => true,
    shouldDescendIntoTool: () => true,
  }
}
```

### Important middleware behaviors

- Use `yield* next(c)` unless you intentionally do manual stream iteration.
- Middleware can emit custom events; runtime metadata (`path`, `timestamp`, `nodeId`, `parentId`) is injected automatically.
- Runtime middleware (`run(..., { middleware })`) executes inside config middleware.

### Built-in fallback middleware

```ts
import { fallback } from "@gumbee/agent"
import { anthropic } from "@ai-sdk/anthropic"

const resilient = agent({
  name: "resilient",
  description: "Agent with fallback",
  model: openai("gpt-4o"),
  middleware: [fallback({ model: anthropic("claude-sonnet-4-5") })],
})
```

---

## 11) Widgets (Rich Structured UI Output)

Widgets let the model produce typed UI payloads incrementally.

### Register widgets

```ts
import { agent, DescribeRegistry, z } from "@gumbee/agent"

const TextWidget = z.object({
  type: z.literal("text"),
  text: z.string(),
})

const TodoWidget = z.object({
  type: z.literal("todo_list"),
  items: z.array(z.object({ id: z.string(), label: z.string() })),
})

const widgets = new DescribeRegistry()
  .add(TextWidget, { id: "Text", description: "Display markdown text", always: true })
  .add(TodoWidget, { id: "TodoList", description: "Display actionable tasks" })

const uiAgent = agent({
  name: "ui-agent",
  description: "Returns rich UI widgets",
  model: openai("gpt-4o"),
  widgets,
  widgetsPickerModel: openai("gpt-4o-mini"),
})
```

### Consume widget updates

```ts
const { stream } = uiAgent.run("Build an implementation checklist.", {})

for await (const event of stream) {
  if (event.type === "widget-delta") {
    console.log(event.index, event.widget)
  }
}
```

### Registry meta options

- `id` (required): unique schema identity
- `description`: improves LLM schema selection
- `aliases`: additional schema names
- `always`: always include in available type definitions
- `utility`: helper type, not top-level output type
- `dependencies`: include related types when selected
- `rules`: additional schema instructions

---

## 12) Structured Output (`structured()`)

`structured()` is used when you want direct schema-constrained JSON output instead of an agent loop.

```ts
import { structured, z } from "@gumbee/agent"
import { google } from "@ai-sdk/google"

const { object } = structured({
  model: google("gemini-2.5-flash-preview-09-2025"),
  messages: [{ role: "user", content: "Give weather in Tokyo." }],
  schema: z.object({
    conditions: z.string(),
    feelsLike: z.number().alternate(z.string(), (v) => parseFloat(v)),
    humidity: z.number().alternate(z.string(), (v) => parseInt(v, 10)),
  }),
})

const result = await object
```

---

## 13) Execution Graph and Tracing

Every run can produce a trace tree using `ExecutionGraph`.

### Access

```ts
const { stream, graph } = assistant.run("Analyze this request.", {})

for await (const _event of stream) {
  // graph is populated incrementally as events are consumed
}

console.log(graph.root)
```

### What the graph gives you

- Hierarchical agent/tool nodes
- Status transitions (`pending`/`running`/`completed`/`failed`)
- Node messages, errors, model IDs, provider names
- Usage counters (`inputTokens`, `outputTokens`, `totalTokens`) for cost analysis

### Browser-safe graph import

Use:

```ts
import { ExecutionGraph } from "@gumbee/agent/graph"
```

when you only need graph types/runtime in browser-compatible contexts.

## 15) Condensed API Reference

Common imports:

```ts
import {
  // factories
  agent,
  tool,
  structured,

  // schema + widget registry
  z,
  DescribeRegistry,

  // memory
  SimpleMemory,
  SlidingWindowMemory,
  TokenWindowMemory,

  // middleware
  fallback,

  // stop conditions
  stopAfterSteps,
  stopOnFinish,
  stopOnToolCall,
  stopAny,
  stopAll,
  DEFAULT_STOP_CONDITION,

  // graph
  ExecutionGraph,

  // events/type guards
  isAgentBegin,
  isAgentEnd,
  isAgentStepBegin,
  isAgentStepLLMCall,
  isAgentStepEnd,
  isAgentStream,
  isToolBegin,
  isToolEnd,
  isToolProgress,
  isToolError,
  isWidgetDelta,
} from "@gumbee/agent"
```

---

## 16) Practical Checklist for New Agent Builders

1. Define an agent with clear `name`, `description`, `system`.
2. Add strongly typed tools with Zod schemas.
3. Decide memory strategy (`SimpleMemory`, sliding, or token budget).
4. Add middleware for reliability/telemetry if desired (`fallback`, observability, caching).
5. Stream all events and handle `agent-stream`, tool events, and widget deltas. Widget deltas are only provided if a widget registry is given. If widget deltas are used, text-delta parts in agent-stream can be ignored (text widget is returned in widget-delta)
6. Add stop conditions if task complexity requires stricter loop control.
7. Use subagents for decomposition when one prompt is not enough.
8. Persist/inspect execution graphs for debugging and cost analytics.
