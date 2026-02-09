/**
 * Minimal execution node for runtime context tracking.
 *
 * Nodes hold only structural/topological data (id, parent, path).
 * Rich graph data (status, events, messages, etc.) is built by
 * ExecutionGraph from events.
 */

export interface Node {
  readonly id: string
  readonly parent: Node | null
  readonly path: string[]
}
