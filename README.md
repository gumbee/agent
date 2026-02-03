# @gumbee/agent

AI SDK integration for structured and rich LLM responses.

## Installation

```bash
npm install @gumbee/agent ai
```

## Usage

### Structured Output

Stream structured JSON objects from a language model with progressive parsing:

```ts
import { structured } from "@gumbee/agent"
import { z } from "@gumbee/structured"
import { openai } from "@ai-sdk/openai"

const result = structured({
  model: openai("gpt-4o"),
  schema: z.object({ name: z.string(), age: z.number() }),
  prompt: "Generate a person",
})

// Stream partial objects as they build
for await (const partial of result.partials) {
  console.log(partial) // { name: "Jo" }, { name: "John" }, { name: "John", age: 30 }
}

// Or await the final object
const person = await result.object
```

### Rich Widgets

Stream rich widget responses for dynamic UI rendering:

```ts
import { rich } from "@gumbee/agent"
import { DescribeRegistry } from "@gumbee/structured/describe"
import { openai } from "@ai-sdk/openai"

const registry = new DescribeRegistry()
// Register your widget schemas...

const { widgets } = rich({
  model: openai("gpt-4o"),
  widgets: registry,
  messages: [...],
})

for await (const snapshot of widgets) {
  // Stream to frontend to display widgets
}
```

## License

MIT
