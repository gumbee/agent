# Memory

Memory is responsible for storing and retrieving conversation history during an agent's execution. It tracks both initial messages (conversation context) and messages appended during a run.

## The Memory Interface

```typescript
interface Memory {
  read(): Promise<ModelMessage[]>
  store(message: ModelMessage): void | Promise<void>
  appended(): Promise<ModelMessage[]>
}
```

| Method       | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `read()`     | Returns all messages (initial + appended)                       |
| `store(msg)` | Stores a new message (user, assistant, or tool result)          |
| `appended()` | Returns only messages added after initialization (new this run) |

## SimpleMemory

`SimpleMemory` is the built-in memory implementation. It stores messages in an in-memory array and tracks which messages were part of the initial state vs. which were added during the run.

```typescript
import { SimpleMemory } from "@gumbee/agent"

// Empty memory (fresh conversation)
const memory = new SimpleMemory()

// Memory with prior conversation history
const memory = new SimpleMemory([
  { role: "user", content: "Hello" },
  { role: "assistant", content: [{ type: "text", text: "Hi there!" }] },
])
```

### How `appended()` Works

`SimpleMemory` tracks an `initialCount` -- the number of messages at construction time. The `appended()` method returns `messages.slice(initialCount)`, giving you only the messages that were added during the current run.

```typescript
const memory = new SimpleMemory([
  { role: "user", content: "Hello" },
  { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
])
// initialCount = 2

// After running the agent, new messages are stored via store()
// appended() returns only the new messages:
const newMessages = await memory.appended()
// e.g., [
//   { role: "user", content: "What's the weather?" },
//   { role: "assistant", content: [{ type: "text", text: "Let me check..." }, { type: "tool-call", ... }] },
//   { role: "tool", content: [{ type: "tool-result", ... }] },
//   { role: "assistant", content: [{ type: "text", text: "It's 72°F in Tokyo." }] },
// ]
```

This is used internally to:

- Extract the agent's final response after a run
- Provide step-end events with the messages from that step

## Using Memory with Agents

### Default Memory

If no memory is provided, a fresh `SimpleMemory()` is created for each run:

```typescript
const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  // No memory specified -- new SimpleMemory() created per run
})
```

### Agent-Level Default

Set a default memory on the agent configuration:

```typescript
const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  memory: new SimpleMemory(conversationHistory),
})
```

### Per-Run Override

Override memory for a specific run:

```typescript
const { stream } = myAgent.run("Continue our conversation", context, {
  memory: new SimpleMemory(previousMessages),
})
```

### Priority

Memory is resolved in this order:

1. Run options (`options.memory`)
2. Agent config (`config.memory`)
3. New `SimpleMemory()` (fallback)

## How Memory Integrates with the Agent Loop

Understanding how memory is used internally helps when implementing custom memory strategies.

### 1. User Message Storage

When `agent.run(prompt)` is called, the user prompt is appended to the memory:

```
memory.store({ role: "user", content: prompt })
```

### 2. Reading for LLM Context

At each step, all messages are read from memory. System messages from memory are filtered out (the agent constructs its own system prompt):

```
messages = await memory.read()
messages = messages.filter(m => m.role !== "system")
llmMessages = [{ role: "system", content: systemPrompt }, ...messages]
```

### 3. Storing New Messages

After each LLM call, new assistant messages and tool results are stored:

```
for (const message of newMessages) {
  await memory.store(message)
}
```

### 4. Step Events

After each step, `appended()` is called to include the new messages in step-end events:

```
const appended = await memory.appended()
yield { type: "agent-step-end", step, finishReason, appended }
```

### 5. Final State

After the loop completes, all messages are read one final time and stored on the execution node:

```
node.setMessages(await memory.read())
```

### 6. Extracting the Response

The agent extracts its final response using `appended()` -- it finds the last assistant message among the appended messages:

```typescript
const response = await memory.appended().then((msgs) => msgs.findLast((m) => m.role === "assistant")?.content)
```

## Custom Memory Strategies

Implement the `Memory` interface to create custom strategies.

### Auto-Summarizing Memory

This strategy automatically summarizes older messages to keep the context window manageable:

```typescript
import type { Memory, ModelMessage } from "@gumbee/agent"

class SummarizingMemory implements Memory {
  private messages: ModelMessage[] = []
  private initialCount = 0
  private maxMessages: number
  private summarizer: (messages: ModelMessage[]) => Promise<string>

  constructor(
    messages: ModelMessage[] = [],
    options: {
      maxMessages?: number
      summarizer: (messages: ModelMessage[]) => Promise<string>
    },
  ) {
    this.messages = [...messages]
    this.initialCount = this.messages.length
    this.maxMessages = options.maxMessages ?? 20
    this.summarizer = options.summarizer
  }

  async read(): Promise<ModelMessage[]> {
    if (this.messages.length <= this.maxMessages) {
      return [...this.messages]
    }

    // Summarize older messages, keep recent ones
    const cutoff = this.messages.length - this.maxMessages
    const oldMessages = this.messages.slice(0, cutoff)
    const recentMessages = this.messages.slice(cutoff)

    const summary = await this.summarizer(oldMessages)

    return [{ role: "user", content: `[Previous conversation summary: ${summary}]` }, ...recentMessages]
  }

  async store(message: ModelMessage): Promise<void> {
    this.messages.push(message)
  }

  async appended(): Promise<ModelMessage[]> {
    return this.messages.slice(this.initialCount)
  }
}

// Usage
const memory = new SummarizingMemory(previousMessages, {
  maxMessages: 20,
  summarizer: async (messages) => {
    // Use an LLM to summarize the conversation
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Summarize this conversation concisely:\n${JSON.stringify(messages)}`,
    })
    return text
  },
})

const myAgent = agent({
  name: "assistant",
  description: "An assistant",
  model: openai("gpt-4o"),
  memory: memory,
})
```

### Sliding Window Memory

Keep only the most recent N messages:

```typescript
import type { Memory, ModelMessage } from "@gumbee/agent"

class SlidingWindowMemory implements Memory {
  private messages: ModelMessage[] = []
  private initialCount = 0
  private windowSize: number

  constructor(messages: ModelMessage[] = [], windowSize = 30) {
    this.messages = [...messages]
    this.initialCount = this.messages.length
    this.windowSize = windowSize
  }

  async read(): Promise<ModelMessage[]> {
    // Always return only the most recent N messages
    return this.messages.slice(-this.windowSize)
  }

  async store(message: ModelMessage): Promise<void> {
    this.messages.push(message)
  }

  async appended(): Promise<ModelMessage[]> {
    return this.messages.slice(this.initialCount)
  }
}
```
