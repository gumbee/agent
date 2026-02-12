import { serve } from "@hono/node-server"
import { type Server } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createNodeWebSocket } from "@hono/node-ws"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import { cors } from "hono/cors"
import * as Y from "yjs"
import { getYDoc, setupWS, handleMessage } from "./yjs-sync"
import type { AddEventsPayload, CreateTracePayload, TraceInfo } from "./types"

export function startDashboard(options: { port?: number } = {}): Server {
  const dashboardDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "dashboard")
  const port = options.port || 4500
  const app = new Hono()

  // In-memory trace index — created inside the function to avoid
  // top-level crypto.getRandomValues() calls which are disallowed
  // in Cloudflare Workers global scope.
  const traces = new Map<string, TraceInfo>()
  const indexDoc = new Y.Doc()
  const indexMap = indexDoc.getMap<TraceInfo>("traces")

  // Per-trace tracking of root agents (agents without a parentId).
  // Maps traceId -> Map<nodeId, "running" | "completed" | "failed">
  const rootAgents = new Map<string, Map<string, "running" | "completed" | "failed">>()

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  app.use("/*", cors())

  // WebSocket route for trace index
  app.get(
    "/api/yjs/traces",
    upgradeWebSocket(() => {
      let cleanup: () => void
      return {
        onOpen(_event, ws) {
          cleanup = setupWS(ws, indexDoc)
        },
        onMessage(event, ws) {
          handleMessage(ws, indexDoc, event.data)
        },
        onClose() {
          if (cleanup) cleanup()
        },
      }
    }),
  )

  // WebSocket route for Yjs sync
  app.get(
    "/api/yjs/:traceId",
    upgradeWebSocket((c) => {
      const traceId = c.req.param("traceId")
      const doc = getYDoc(traceId)
      let cleanup: () => void

      return {
        onOpen(_event, ws) {
          cleanup = setupWS(ws, doc)
        },
        onMessage(event, ws) {
          handleMessage(ws, doc, event.data)
        },
        onClose(_event, ws) {
          if (cleanup) cleanup()
        },
      }
    }),
  )

  // API Routes
  app.post("/api/traces", async (c) => {
    const payload = await c.req.json<CreateTracePayload>()
    const doc = getYDoc(payload.id)

    const traceInfo: TraceInfo = {
      id: payload.id,
      name: payload.name,
      status: "pending",
      startTime: payload.startTime,
      tags: payload.tags,
      metadata: payload.metadata,
    }

    // Update index
    traces.set(payload.id, traceInfo)

    // Update Yjs index
    indexDoc.transact(() => {
      indexMap.set(payload.id, traceInfo)
    })

    // Update Yjs doc
    doc.transact(() => {
      const meta = doc.getMap("meta")
      meta.set("info", traceInfo)
    })

    return c.json({ success: true, id: payload.id })
  })

  app.post("/api/events", async (c) => {
    const { traceId, events: batch } = await c.req.json<AddEventsPayload>()
    const doc = getYDoc(traceId)

    doc.transact(() => {
      const events = doc.getArray("events")

      events.push(batch)

      // Track root agents and update trace status
      for (const { data: event } of batch) {
        // Register root agents (agents that begin without a parentId)
        if (event.type === "agent-begin" && !event.parentId) {
          let agents = rootAgents.get(traceId)
          if (!agents) {
            agents = new Map()
            rootAgents.set(traceId, agents)
          }
          agents.set(event.nodeId, "running")

          // Mark trace as running on first agent-begin
          const meta = doc.getMap("meta")
          const info = meta.get("info") as TraceInfo | undefined
          if (info && info.status === "pending") {
            const newInfo = { ...info, status: "running" as const }
            meta.set("info", newInfo)
            traces.set(traceId, newInfo)
            indexDoc.transact(() => {
              indexMap.set(traceId, newInfo)
            })
          }
        }

        // When an agent ends or errors, check if it's a root agent
        if (event.type === "agent-end" || event.type === "agent-error") {
          const agents = rootAgents.get(traceId)
          if (agents?.has(event.nodeId)) {
            agents.set(event.nodeId, event.type === "agent-error" ? "failed" : "completed")

            // Check if ALL root agents are done
            const allDone = [...agents.values()].every((s) => s === "completed" || s === "failed")
            if (allDone) {
              // If any root agent failed, the trace is failed.
              // Use the last finishing agent's status to determine the final state:
              // if it errored, trace is failed; otherwise check if any failed.
              const anyFailed = [...agents.values()].some((s) => s === "failed")
              const meta = doc.getMap("meta")
              const info = meta.get("info") as TraceInfo | undefined

              if (info) {
                const newInfo = {
                  ...info,
                  status: (anyFailed ? "failed" : "completed") as TraceInfo["status"],
                  endTime: event.timestamp,
                }
                meta.set("info", newInfo)
                traces.set(traceId, newInfo)

                indexDoc.transact(() => {
                  indexMap.set(traceId, newInfo)
                })
              }
            }
          }
        }
      }
    })

    return c.json({ success: true })
  })

  app.get("/api/traces", (c) => {
    return c.json({ traces: Array.from(traces.values()).sort((a, b) => b.startTime - a.startTime) })
  })

  app.get("/api/traces/:id", (c) => {
    const id = c.req.param("id")
    const trace = traces.get(id)
    if (!trace) return c.json({ error: "Trace not found" }, 404)
    return c.json({ trace })
  })

  // Serve static dashboard
  // Resolve relative to compiled server module so the CLI works from any cwd.
  app.use("/*", serveStatic({ root: dashboardDir }))

  const server = serve({
    fetch: app.fetch,
    port,
  })

  injectWebSocket(server)

  console.log(`Observability dashboard running at http://localhost:${port}`)

  return server
}
