# Application Context

Application context allows you to pass request-specific data—like user IDs, database connections, or request headers—into your agent and its tools. This context is strongly typed and flows through the entire execution graph.

## Defining Context

Define a TypeScript type for your context. This ensures type safety when accessing context in system prompts and tools.

```typescript
import { agent } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

// 1. Define your application context type
type AppContext = {
  userId: string
  db: DatabaseConnection
  requestId: string
}

// 2. Create the agent with the context type
const myAgent = agent<AppContext>({
  name: "assistant",
  description: "A helpful assistant",
  model: openai("gpt-4o"),
  // ...
})
```

## Dynamic System Prompts

The `system` option can be a function that receives the context and returns the system prompt string (or a Promise resolving to it). This is perfect for injecting dynamic information like the current time or fetching user-specific instructions from a database.

```typescript
const myAgent = agent<AppContext>({
  // ...
  system: async (context) => {
    // Fetch user dynamically from DB using the ID from context
    const user = await context.db.users.findUnique({
      where: { id: context.userId },
    })

    // Get current time in user's timezone
    const now = new Date().toLocaleString("en-US", {
      timeZone: user.timezone,
    })

    return `
You are a helpful assistant for ${user.name}.
Current time: ${now}
User Role: ${user.role}

${user.role === "admin" ? "You have access to administrative tools." : ""}
    `
  },
})
```

## Accessing Context in Tools

Tools receive the context as the second argument to their `execute` function.

```typescript
import { tool, z } from "@gumbee/agent"

const getOrdersTool = tool<AppContext>({
  name: "get_orders",
  description: "Get recent orders",
  input: z.object({
    limit: z.number().default(5),
  }),
  execute: async ({ limit }, context) => {
    // Access database from context
    return await context.db.orders.findMany({
      where: { userId: context.userId },
      take: limit,
    })
  },
})
```

## Full Example

Here is a complete example showing how to wire everything together:

```typescript
import { agent, tool, z } from "@gumbee/agent"
import { openai } from "@ai-sdk/openai"

// 1. Define Context
type AppContext = {
  userId: string
  db: any // Replace with your DB type
}

// 2. Define Tool using Context
const updateProfileTool = tool<AppContext>({
  name: "update_profile",
  description: "Update user profile settings",
  input: z.object({
    key: z.enum(["theme", "notifications"]),
    value: z.string(),
  }),
  execute: async ({ key, value }, context) => {
    console.log(`Updating ${key} for user ${context.userId}`)
    await context.db.users.update({
      where: { id: context.userId },
      data: { [key]: value },
    })
    return { success: true }
  },
})

// 3. Create Agent with Dynamic System Prompt
const assistant = agent<AppContext>({
  name: "personal-assistant",
  description: "A personalized assistant",
  model: openai("gpt-4o"),
  tools: [updateProfileTool],
  system: async (context) => {
    // Async fetch of user data
    const user = await context.db.users.findUnique({
      where: { id: context.userId },
    })

    const time = new Date().toLocaleTimeString("en-US", {
      timeZone: user.timezone,
    })

    return `You are helpful assistant for ${user.name}. The local time is ${time}.`
  },
})

// 4. Run with Context
const context: AppContext = {
  userId: "user_123",
  db: myDatabase,
}

const { stream } = assistant.run("Turn off my notifications", context)

for await (const event of stream) {
  if (event.type === "agent-stream" && event.part.type === "text-delta") {
    process.stdout.write(event.part.textDelta)
  }
}
```

## Context Flow

1. **Injection**: Context is passed to `agent.run(prompt, context)`.
2. **Propagation**: The context object is passed by reference to:
   - The system prompt function
   - All tools executed by the agent
   - Any subagents called by the agent (subagents receive the same context instance)
3. **Middleware**: Middleware also receives the context, allowing for cross-cutting concerns like logging or permission checks based on user roles.
