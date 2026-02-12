# Observability

The observability system provides a real-time dashboard for inspecting agent execution traces. It consists of two parts:

1. **Dashboard server** -- a local web UI that visualises traces, events, and the agent execution graph.
2. **Observability middleware** -- a middleware that streams every runtime event from your agent to the dashboard server.

https://github.com/user-attachments/assets/6a2f42b3-ff47-4199-98d2-8f6ba8a43e95

## Running the Dashboard

The dashboard ships as part of `@gumbee/agent` and can be launched with a single command. No extra installation is required.

### With bunx

```bash
bunx @gumbee/agent observe
```

### With npx

```bash
npx @gumbee/agent observe
```

By default the dashboard starts on port **4500**. You can change the port with the `AGENT_DASHBOARD_PORT` environment variable:

```bash
AGENT_DASHBOARD_PORT=5000 bunx @gumbee/agent observe
```

Once running, open [http://localhost:4500](http://localhost:4500) in your browser to view the dashboard.

## Sending Events to the Dashboard

Use the built-in `observability` middleware to stream events from your agent to the dashboard. The middleware batches events and sends them over HTTP, so it works with any runtime (Node.js, Bun, Cloudflare Workers, etc.).

### Basic Setup

```typescript
import { agent } from "@gumbee/agent"
import { observability } from "@gumbee/agent/observability"
import { openai } from "@ai-sdk/openai"

const myAgent = agent({
  name: "assistant",
  model: openai("gpt-4o"),
  system: "You are a helpful assistant.",
  middleware: [observability()],
})
```

By default the middleware sends events to `http://localhost:4500`. It will POST trace metadata and event batches to `<apiUrl>/api/traces` and `<apiUrl>/api/events` respectively.

### Options

```typescript
observability(options?: ObservabilityOptions)
```

| Option            | Type                                  | Default                   | Description                                                                                     |
| ----------------- | ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `apiUrl`          | `string`                              | `"http://localhost:4500"` | URL of the observability dashboard server.                                                      |
| `enabled`         | `boolean`                             | `true`                    | Set to `false` to disable the middleware (useful for production).                               |
| `flushIntervalMs` | `number`                              | `150`                     | How often (in ms) the event buffer is flushed to the server.                                    |
| `waitUntil`       | `(promise: Promise<unknown>) => void` | --                        | Keeps the runtime alive until all in-flight requests complete. Required for Cloudflare Workers. |

### Cloudflare Workers

In environments where the runtime may terminate before background requests complete (e.g. Cloudflare Workers), pass the `waitUntil` function from the execution context:

```typescript
import { observability } from "@gumbee/agent/observability"

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const myAgent = agent({
      name: "assistant",
      model: openai("gpt-4o"),
      system: "You are a helpful assistant.",
      middleware: [
        observability({
          waitUntil: ctx.waitUntil.bind(ctx),
        }),
      ],
    })

    // ... use agent ...
  },
}
```

### Toggling at Runtime

You can conditionally enable observability based on your environment:

```typescript
observability({
  enabled: process.env.NODE_ENV !== "production",
})
```

### Per-Request Middleware

If you prefer to attach observability only for certain requests, pass it as runtime middleware:

```typescript
const { stream } = myAgent.run("Hello", context, {
  middleware: [observability()],
})
```

## How It Works

When attached to an agent, the observability middleware:

1. **Registers a trace** -- on agent start, it sends a `POST /api/traces` request with a unique trace ID (derived from the run ID) and metadata.
2. **Buffers events** -- as the agent yields events (tool calls, text deltas, sub-agent activity, etc.), the middleware collects them in an in-memory buffer with monotonic indices and high-resolution timestamps.
3. **Flushes periodically** -- every `flushIntervalMs` (default 150 ms), the buffer is flushed to `POST /api/events` as a batch.
4. **Final flush** -- when the agent stream ends (or errors), any remaining events are flushed and all in-flight requests are awaited.

The dashboard server syncs state in real time via Yjs over WebSocket, so the UI updates live as events arrive.
