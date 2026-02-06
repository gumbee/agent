# Stop Conditions

Stop conditions control when an agent's execution loop terminates. They are evaluated after each step and determine whether the agent should continue or stop.

## The StopCondition Type

A stop condition is a function that receives information about the current step and returns a boolean (or a promise resolving to a boolean):

```typescript
type StopConditionInfo = {
  step: number // Current step number (0-based)
  finishReason: FinishReason // Why the LLM stopped generating
  messages: ModelMessage[] // All messages in memory
}

type StopCondition = (info: StopConditionInfo) => boolean | Promise<boolean>
```

When a stop condition returns `true`, the agent loop terminates.

## Default Behavior

If no `stopCondition` is provided, the agent uses the default:

```typescript
import { DEFAULT_STOP_CONDITION } from "@gumbee/agent"

// Equivalent to:
const DEFAULT_STOP_CONDITION = stopAny(stopAfterSteps(30), stopOnFinish())
```

This means the agent stops after 30 steps **or** when the model finishes without requesting tool calls -- whichever comes first.

## Built-in Stop Conditions

### `stopAfterSteps(maxSteps)`

Stops after a fixed number of steps, regardless of finish reason.

```typescript
import { stopAfterSteps } from "@gumbee/agent"

const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  stopCondition: stopAfterSteps(5), // Stop after 5 steps
})
```

The condition evaluates `step >= maxSteps - 1` (step is 0-based), so `stopAfterSteps(1)` means the agent will execute exactly one LLM call.

### `stopOnFinish()`

Stops when the model finishes generating without requesting any tool calls. This is the most common condition -- the agent keeps looping as long as the model wants to use tools, and stops when it produces a final text response.

```typescript
import { stopOnFinish } from "@gumbee/agent"

const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  stopCondition: stopOnFinish(),
})
```

### `stopOnToolCall(toolName)`

Stops when a specific tool has been called. This is useful for agents that should terminate after calling a "final answer" or "submit" tool.

```typescript
import { stopOnToolCall, tool, z } from "@gumbee/agent"

const submitAnswer = tool({
  name: "submit_answer",
  description: "Submit the final answer",
  input: z.object({ answer: z.string() }),
  execute: async ({ answer }) => ({ answer }),
})

const myAgent = agent({
  name: "solver",
  description: "A problem solver",
  model: openai("gpt-4o"),
  tools: [searchTool, submitAnswer],
  stopCondition: stopOnToolCall("submit_answer"),
})
```

The condition checks all messages in memory for an assistant message containing a tool call with the specified name.

## Combinators

Combine multiple stop conditions using logical operators.

### `stopAny(...conditions)` -- OR

Stops if **any** of the conditions return `true`:

```typescript
import { stopAny, stopAfterSteps, stopOnFinish, stopOnToolCall } from "@gumbee/agent"

const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  stopCondition: stopAny(
    stopAfterSteps(10), // Stop after 10 steps
    stopOnFinish(), // OR stop when model finishes
    stopOnToolCall("done"), // OR stop when "done" tool is called
  ),
})
```

### `stopAll(...conditions)` -- AND

Stops only if **all** conditions return `true`:

```typescript
import { stopAll, stopOnFinish } from "@gumbee/agent"

const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  stopCondition: stopAll(
    stopOnFinish(),
    ({ step }) => step >= 1, // Only stop if finished AND at least 2 steps completed
  ),
})
```

This is useful when you want to ensure the agent runs for a minimum number of steps before allowing it to finish.

## Custom Stop Conditions

Since stop conditions are just functions, you can write any custom logic:

### Based on Message Count

```typescript
const stopOnTooManyMessages: StopCondition = ({ messages }) => {
  return messages.length > 50
}
```

### Conditional Logic

```typescript
const customStop: StopCondition = ({ step, finishReason, messages }) => {
  // Always stop after 20 steps (step is 0-based, so step 19 = 20th step)
  if (step >= 19) return true

  // Stop on finish only after at least 3 steps (step 2 = 3rd step)
  if (step >= 2 && finishReason !== "tool-calls") return true

  return false
}
```

### Async Stop Conditions

Stop conditions can be asynchronous, which is useful when the decision depends on external state:

```typescript
const asyncStop: StopCondition = async ({ step, messages }) => {
  // Check an external flag
  const shouldStop = await checkExternalCondition()
  if (shouldStop) return true

  // Fallback: stop after 15 steps (step is 0-based)
  return step >= 14
}
```

### Combining Custom and Built-in Conditions

```typescript
import { stopAny, stopAfterSteps, stopOnToolCall } from "@gumbee/agent"

const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  stopCondition: stopAny(
    stopAfterSteps(25),
    stopOnToolCall("submit"),
    ({ messages }) => messages.length > 100, // Inline custom condition
  ),
})
```

## Summary

| Condition                | Behavior                                      |
| ------------------------ | --------------------------------------------- |
| `stopAfterSteps(n)`      | Stops after `n` steps (`step >= n - 1`)       |
| `stopOnFinish()`         | Stops when model finishes (no tool calls)     |
| `stopOnToolCall(name)`   | Stops when the named tool has been called     |
| `stopAny(...conds)`      | Stops if any condition is true (OR)           |
| `stopAll(...conds)`      | Stops if all conditions are true (AND)        |
| `DEFAULT_STOP_CONDITION` | `stopAny(stopAfterSteps(30), stopOnFinish())` |
