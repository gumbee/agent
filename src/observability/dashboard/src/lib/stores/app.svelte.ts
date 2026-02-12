import type { TraceInfo } from "@gumbee/agent/observability"
import { TraceStore } from "./trace.svelte"
import { selection } from "./selection.svelte"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"

export class AppStore {
  traces: TraceInfo[] = $state([])
  activeTraceId: string | null = $state(null)
  trace: TraceStore | null = $state(null)
  loading = $state(true)

  private indexDoc: Y.Doc | null = null
  private indexProvider: WebsocketProvider | null = null

  get activeTrace(): TraceInfo | undefined {
    return this.traces.find((t) => t.id === this.activeTraceId)
  }

  // Convenience derived - resolved from the active trace's graph
  // We put it here to avoid circular dependency in SelectionStore
  get selectedNode() {
    return this.trace?.getNode(selection.selectedNodeId ?? "") ?? null
  }

  selectTrace(id: string) {
    if (this.activeTraceId === id) return
    this.trace?.destroy()
    this.activeTraceId = id
    this.trace = new TraceStore(id)
    selection.clearSelection()
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const url = `${protocol}//${host}/api/yjs`

    this.indexDoc = new Y.Doc()
    this.indexProvider = new WebsocketProvider(url, "traces", this.indexDoc)
    this.indexProvider.on("sync", (isSynced: boolean) => {
      if (isSynced) {
        this.loading = false
      }
    })

    const tracesMap = this.indexDoc.getMap<TraceInfo>("traces")
    let synced = false

    tracesMap.observe(() => {
      const entries = Array.from(tracesMap.values())
      this.traces = entries.sort((a, b) => b.startTime - a.startTime)

      if (!synced) {
        // First sync: just populate known IDs, auto-select latest
        synced = true
        if (!this.activeTraceId && this.traces.length > 0) {
          this.selectTrace(this.traces[0].id)
        }
        return
      }

      // Subsequent updates: auto-switch to the newest trace
      if (this.traces.length > 0 && this.traces[0].id !== this.activeTraceId) {
        this.selectTrace(this.traces[0].id)
      }
    })
  }

  destroy() {
    this.indexProvider?.destroy()
    this.indexDoc?.destroy()
    this.trace?.destroy()
  }
}

export const app = new AppStore()
