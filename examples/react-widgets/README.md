# @gumbee/agent React Widgets Example

A Next.js chat app that demonstrates the `@gumbee/agent` widget system. Instead of plain text responses, the agent emits structured, typed widgets that render into rich UI components.

## Features

- Agent configured with `widgets` via `DescribeRegistry`
- System prompt enforces widget-first responses
- Zod-based widget schemas with `.alias()` and `.flexible()` normalization
- Utility shared type (`Symptom`) reused across multiple widgets
- Domain widgets:
  - `TextWidget`
  - `MedicationDetailWidget`
  - `MedicationListWidget`
  - `SymptomListWidget`
- Stream-safe rendering with `DeepPartial` widget payloads
- Same chat/runtime foundation as the basic example (SSE, memory, tools, observability)

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
│   └── widgets/
│       ├── Widgets.tsx
│       ├── TextWidget.tsx
│       ├── MedicationDetailWidget.tsx
│       ├── MedicationListWidget.tsx
│       ├── SymptomListWidget.tsx
│       └── types.ts
└── features/
    ├── backend/
    │   └── agent/agent.ts
    └── widgets/
        ├── index.ts
        └── helpers.ts
```

## Key Concepts

### 1) Define widget schemas

```ts
export const TextWidget = z.object({
  type: normalizedTypeName("text"),
  text: z.string().alias(["content", "value", "body"]),
})
```

Widget types are schema-first and made to conform the schema (if possible) before rendering.

### 2) Register widgets with `DescribeRegistry`

```ts
const chatWidgets = new DescribeRegistry()
  .add(Symptom, { id: "Symptom", utility: true })
  .add(TextWidget, { id: "Text", always: true // always pass text widget definition to agent (others are dynamically picked) })
  .add(MedicationDetailWidget, { id: "MedicationDetail" })
  .add(MedicationListWidget, { id: "MedicationList" })
  .add(SymptomListWidget, { id: "SymptomList" })
```

- `utility: true` shares a type without treating it as a top-level rendered widget.
- `always: true` makes sure the given type is always provided to the agent (higher LLM token usage)

### 3) Attach widgets to the agent

```ts
export const chatAgent = agent({
  model: openai("gpt-4o-mini"),
  tools: [weatherTool, searchTool, userBenefitsTool],
  widgets: chatWidgets,
  middleware: [observability()],
})
```

### 4) Render streamed widget payloads

```tsx
type WidgetsProps = {
  widget: DeepPartial<UiChatWidget>
}
```

During streaming, partial widget objects can arrive before the full payload is complete. `DeepPartial` allows progressive rendering without type errors. Using utilites from `@gumbee/structured` you can also check at runtime if a given field is completed or still streaming. Check the [@gumbee/structured](https://github.com/gumbee/structured) package for more details

## Notes

- Widget schemas use helper normalization (`normalize`, `normalizedTypeName`) so common alias formats are accepted.
- This is ideal when you want strongly typed, component-driven responses rather than free-form text output.
