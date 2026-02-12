import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import { ExecutionGraph, type ExecutionGraphNode, type RuntimeYield } from "@gumbee/agent/graph"
import { getLayout } from "../utils/layout"
import type { Node, Edge } from "@xyflow/svelte"
import { debounce } from "@gumbee/utils"

/** Wrapper stored in the Yjs events array with a deterministic order index */
interface StoredEvent {
  index: number
  ts: number
  data: RuntimeYield
}

export class TraceStore {
  doc = new Y.Doc()
  provider: WebsocketProvider | null = null

  // Reactive state
  nodes: Node[] = $state([])
  edges: Edge[] = $state([])
  events: RuntimeYield[] = $state([])
  status = $state("connecting")
  rootNode: ExecutionGraphNode | null = $state(null)

  // Use $state.raw to track assignment without deep proxying
  graph: ExecutionGraph = $state.raw(new ExecutionGraph())

  private layoutVersion = 0
  private previousNodeIds = new Set<string>()

  // Debounce the rebuild to avoid excessive processing on rapid updates
  private rebuild = debounce(() => this.rebuildGraph(), 100)

  constructor(traceId: string) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const url = `${protocol}//${host}/api/yjs`

    this.provider = new WebsocketProvider(url, traceId, this.doc)

    this.provider.on("status", (event: { status: string }) => {
      this.status = event.status
    })

    const eventsArray = this.doc.getArray("events")

    eventsArray.observe(() => {
      const stored = eventsArray.toArray() as StoredEvent[]
      // Sort by monotonic event index to guarantee deterministic sequential ordering
      stored.sort((a, b) => a.index - b.index)
      this.events = stored.map((s) => s.data)

      this.rebuild()
    })
  }

  rebuildGraph() {
    // Create a fresh graph and replay all events
    const newGraph = new ExecutionGraph()

    for (const event of this.events) {
      newGraph.processEvent(event)
    }

    // Assign to trigger reactivity
    this.graph = newGraph

    if (newGraph.root) {
      this.rootNode = newGraph.root

      // Check for structural changes by comparing node IDs
      const newNodeIds = new Set<string>()
      const collectIds = (node: ExecutionGraphNode) => {
        newNodeIds.add(node.id)
        node.children.forEach(collectIds)
      }
      collectIds(newGraph.root)

      let structureChanged = newNodeIds.size !== this.previousNodeIds.size
      if (!structureChanged) {
        for (const id of newNodeIds) {
          if (!this.previousNodeIds.has(id)) {
            structureChanged = true
            break
          }
        }
      }

      this.previousNodeIds = newNodeIds

      if (structureChanged) {
        this.updateLayout()
      } else {
        this.syncNodeData()
      }
    }
  }

  async updateLayout() {
    if (!this.rootNode) return
    const version = ++this.layoutVersion
    const layout = await getLayout(this.rootNode)

    // If a newer updateLayout() was triggered while we were awaiting, discard this result
    if (version !== this.layoutVersion) return

    // Always create new array references so @xyflow/svelte picks up changes
    this.nodes = layout.nodes
    this.edges = layout.edges
  }

  syncNodeData() {
    if (!this.graph) return

    // Immutable update: map to new objects to ensure change detection
    this.nodes = this.nodes.map((node) => {
      const graphNode = this.graph.getNode(node.id)
      if (!graphNode) return node

      // Create new data object
      return {
        ...node,
        data: {
          ...node.data,
          status: graphNode.status,
          input: "input" in graphNode ? graphNode.input : undefined,
          output: "output" in graphNode ? graphNode.output : undefined,
          error: graphNode.error,
          nodeData: graphNode,
        },
      }
    })

    // Sync edge animated state with current target node status
    this.edges = this.edges.map((edge) => {
      const targetNode = this.graph.getNode(edge.target)
      if (!targetNode) return edge
      const animated = targetNode.status === "running"
      if (edge.animated === animated) return edge
      return { ...edge, animated }
    })
  }

  getNode(id: string): ExecutionGraphNode | undefined {
    return this.graph.getNode(id)
  }

  destroy() {
    this.rebuild.cancel()
    this.provider?.destroy()
    this.doc.destroy()
  }
}
