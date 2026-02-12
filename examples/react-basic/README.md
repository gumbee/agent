# @gumbee/agent React Basic Example

A minimal Next.js chat app that demonstrates the core `@gumbee/agent` flow: creating an agent, defining typed tools, injecting runtime context, streaming responses over SSE, and persisting chat history in memory.

## Features

- Agent configured with model, system prompt, tools, and observability middleware
- Typed tools with schema-validated inputs (`get_weather`, `search_web`, `get_user_benefits`)
- Typed user context (`ChatAgentContext`) passed to the agent and tools
- Streaming runtime events from server to client via SSE
- In-memory chat history using `SimpleMemory`
- Frontend chat state with Zustand and incremental streaming updates

## Prerequisites

- Node.js `>= 18`
- An OpenAI API key

## Getting Started

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Add your API key in `.env.local`:

   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the dev server:

   ```bash
   bun run dev
   ```

5. Open `http://localhost:3000`

## Project Structure

```text
.
├── app/
│   ├── api/chats/route.ts
│   ├── api/chats/[chatId]/messages/route.ts
│   └── page.tsx
├── components/
│   ├── ChatInput.tsx
│   ├── ChatMessage.tsx
│   └── SuggestionTags.tsx
└── features/
    ├── backend/
    │   ├── agent/
    │   │   ├── agent.ts
    │   │   ├── context.ts
    │   │   ├── sse.ts
    │   │   └── tools/
    │   ├── chat/db.ts
    │   └── sse/index.ts
    └── chat/
        ├── sse.ts
        └── store/
```

## Key Concepts

### 1) Create an agent

```ts
export const chatAgent = agent({
  name: "support-agent",
  model: openai("gpt-4o-mini"),
  tools: [weatherTool, searchTool, userBenefitsTool],
  middleware: [observability()],
})
```

### 2) Define typed tools

```ts
export const weatherTool = tool({
  name: "get_weather",
  input: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, temperatureC: 22, conditions: "Sunny" }),
})
```

### 3) Use runtime context in tools

```ts
execute: async ({ request }, context: ChatAgentContext) => {
  const isVipUser = context.user.name.trim().toLowerCase() === "john doe"
  // Return personalized guidance based on user context
}
```

### 4) Run with memory and stream over SSE

```ts
const { stream, memory } = chatAgent.run(prompt, context, {
  memory: new SimpleMemory(chat.messages),
})
```

The API route streams events as they are produced and appends generated messages back into the chat record when the stream ends.

## Notes

- This example uses in-memory storage for chat records (`features/backend/chat/db.ts`).
- Tool implementations are intentionally mocked to keep the example focused on runtime and UI flow.
