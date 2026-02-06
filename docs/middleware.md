# Middleware

Middleware provides a powerful way to intercept and modify the execution of agents, tools, and individual LLM steps. It enables cross-cutting concerns like logging, caching, retries, and context modification without changing your core agent logic.

## Core Concepts

The middleware system is built around the `Middleware<Context>` interface, which provides three distinct interception points:

1. **`handleAgent`** - Wraps the entire agent execution.
2. **`handleTool`** - Wraps individual tool executions.
3. **`handleAgentStep`** - Wraps individual LLM steps within the agent loop.

All handlers are optional. If a handler is not provided, the middleware simply passes execution to the next handler in the chain.

### Execution Flow

```mermaid
graph TD
    subgraph "Agent Execution (handleAgent)"
        Start[agent.run()] --> MiddlewareAgent[Middleware]
        MiddlewareAgent --> Loop[Agent Loop]

        subgraph "Step Execution (handleAgentStep)"
            Loop --> StepStart[Start Step]
            StepStart --> MiddlewareStep[Middleware]
            MiddlewareStep --> LLM[LLM Call]
            LLM --> StepEnd[End Step]
        end

        subgraph "Tool Execution (handleTool)"
            StepEnd -- "Tool Call" --> ToolStart[Start Tool]
            ToolStart --> MiddlewareTool[Middleware]
            MiddlewareTool --> ToolExec[Execute Tool]
            ToolExec --> ToolEnd[End Tool]
        end

        StepEnd -- "Finish" --> Done
        ToolEnd --> Loop
    end
```

## The Three Handlers

### 1. Agent Handler (`handleAgent`)

Wraps the entire `agent.run()` call. This is useful for:

- Setting up request-scoped context
- Caching entire agent runs
- Logging start/end of execution
- Global error handling

**Context:** `AgentMiddlewareContext`

- `env`: Runner environment (readonly)
- `memory`: Agent memory (mutable)
- `prompt`: The initial prompt
- `context`: Application context

```typescript
async *handleAgent(c, next) {
  console.log("Agent starting")
  const result = yield* next(c)
  console.log("Agent finished")
  return result
}
```

### 2. Tool Handler (`handleTool`)

Wraps every tool invocation. This is useful for:

- Input validation or transformation
- Output sanitization
- Tool-level logging or metrics
- Mocking tools for testing

**Context:** `ToolMiddlewareContext`

- `tool`: The tool definition (readonly)
- `input`: Tool input arguments
- `context`: Application context

```typescript
async *handleTool(c, next) {
  console.log(`Calling tool ${c.tool.name} with input:`, c.input)
  return yield* next(c)
}
```

### 3. Step Handler (`handleAgentStep`)

Wraps each iteration of the agent loop (each LLM call). This is useful for:

- Per-step retries (e.g., on rate limits)
- Model fallback strategies
- Modifying the system prompt or model dynamically per step
- Inspecting intermediate generated content

**Context:** `AgentStepMiddlewareContext`

- `step`: Current step number (1-indexed, readonly)
- `model`: The language model (mutable - can be swapped)
- `system`: System prompt (mutable)
- `tools`: Available tools (mutable)
- `memory`: Memory instance (mutable)

```typescript
async *handleAgentStep(c, next) {
  // Swap model for step 2
  if (c.step === 2) {
    return yield* next({...c, model: specializedModel})
  }else{
    return yield* next(c)
  }
}
```

## Creating Middleware

Middleware is defined as a function that returns a `Middleware` object. Handlers are async generators that must use `yield*` to delegate to the `next` function.

### Basic Pattern

```typescript
import type { Middleware } from "@gumbee/agent"

export function myMiddleware(): Middleware {
  return {
    async *handleAgent(c, next) {
      // Pre-processing

      // Delegate to next (REQUIRED)
      const result = yield* next(c)

      // Post-processing

      return result
    },
  }
}
```

### Propagation Control

By default, middleware only applies to the agent it is explicitly configured on. It does **not** automatically descend into sub-agents or tools. You can control this behavior using propagation methods:

```typescript
export function pervasiveMiddleware(): Middleware {
  return {
    // ... handlers ...

    // Apply to all sub-agents called by this agent
    shouldDescendIntoAgent: (agent) => true,

    // Apply to all tools called by this agent
    shouldDescendIntoTool: (tool) => true,
  }
}
```

## Registration

Middleware can be registered in two ways:

### 1. Agent Configuration (Persistent)

```typescript
const myAgent = agent({
  name: "helper",
  middleware: [logging(), fallback({ model: backupModel })],
})
```

### 2. Runtime Options (Per-request)

Runtime middleware runs _inside_ the config middleware (closer to the core logic).

```typescript
agent.run("Hello", context, {
  middleware: [requestSpecificMiddleware()],
})
```

## Built-in Middleware

### Fallback

The `fallback` middleware provides resilience by retrying failed LLM steps with a backup model. It only retries if the failure occurs before any content is generated, ensuring no partial output is lost.

```typescript
import { fallback } from "@gumbee/agent"
import { google } from "@ai-sdk/google"

const resilientAgent = agent({
  middleware: [fallback({ model: google("gemini-2.5-flash") })],
})
```

## Examples

### Logging Middleware

A middleware that logs activity at all levels.

```typescript
function logging(): Middleware {
  return {
    async *handleAgent(c, next) {
      console.log(`[Agent] Starting: ${c.prompt.substring(0, 50)}...`)
      const start = Date.now()
      try {
        return yield* next(c)
      } finally {
        console.log(`[Agent] Finished in ${Date.now() - start}ms`)
      }
    },

    async *handleAgentStep(c, next) {
      console.log(`[Step ${c.step}] Using model: ${c.model.modelId}`)
      return yield* next(c)
    },

    async *handleTool(c, next) {
      console.log(`[Tool] Calling ${c.tool.name}`)
      return yield* next(c)
    },

    shouldDescendIntoAgent: () => true,
    shouldDescendIntoTool: () => true,
  }
}
```

### Simple Caching

A middleware that caches agent results and replays them when possible.

```typescript
function simpleCache(): Middleware {
  return {
    async *handleAgent(c, next) {
      // Build the full message list from memory + current prompt
      const messages = await c.memory.read()
      const key = await cache.key(messages)

      if (cache.has(key)) {
        // Replay cached result if it exists
        return yield* cache.replay(key)
      }

      return yield* cache.record(key, next(c))
    },
  }
}
```
