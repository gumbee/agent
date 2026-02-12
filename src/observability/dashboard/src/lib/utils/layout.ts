import type { Node, Edge } from "@xyflow/svelte"
import type { ExecutionGraphNode, NodeStatus } from "@gumbee/agent/graph"

type NodeData = {
  label: string
  status: NodeStatus
  input?: unknown
  output?: unknown
  error?: unknown
  nodeData: ExecutionGraphNode
}

const NODE_WIDTH = 350
const AGENT_HEIGHT = 170
const TOOL_HEIGHT = 20
const HORIZONTAL_GAP = 70
const VERTICAL_GAP = 50

function getNodeHeight(node: ExecutionGraphNode): number {
  return node.type === "agent" ? AGENT_HEIGHT : TOOL_HEIGHT
}

/**
 * Recursively lays out a tree node and its children as a horizontal tree.
 * Each parent's top edge is aligned with its first child's top edge.
 *
 * Returns the total height consumed by this subtree.
 */
function layoutSubtree(node: ExecutionGraphNode, x: number, y: number, positions: Map<string, { x: number; y: number }>): number {
  const height = getNodeHeight(node)

  // Position this node
  positions.set(node.id, { x, y })

  if (!node.children || node.children.length === 0) {
    return height
  }

  // Layout children to the right, first child top-aligned with parent
  const childX = x + NODE_WIDTH + HORIZONTAL_GAP
  let childY = y
  let totalChildrenHeight = 0

  for (let i = 0; i < node.children.length; i++) {
    const subtreeHeight = layoutSubtree(node.children[i], childX, childY, positions)
    totalChildrenHeight += subtreeHeight
    if (i < node.children.length - 1) {
      totalChildrenHeight += VERTICAL_GAP
    }
    childY += subtreeHeight + VERTICAL_GAP
  }

  return Math.max(height, totalChildrenHeight)
}

export function getLayout(rootNode: ExecutionGraphNode | null): { nodes: Node[]; edges: Edge[] } {
  if (!rootNode) return { nodes: [], edges: [] }

  const positions = new Map<string, { x: number; y: number }>()
  const nodes: Node<NodeData>[] = []
  const edges: Edge[] = []

  // Compute positions via recursive tree layout
  layoutSubtree(rootNode, 0, 0, positions)

  // Build flat node and edge lists
  function collect(node: ExecutionGraphNode, parentId?: string) {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }

    nodes.push({
      id: node.id,
      type: node.type === "agent" ? "agent" : node.type === "tool" ? "tool" : "default",
      data: {
        label: node.name ?? node.id,
        status: node.status,
        input: "input" in node ? node.input : undefined,
        output: "output" in node ? node.output : undefined,
        error: node.error,
        nodeData: node,
      },
      position: pos,
    })

    if (parentId) {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        animated: node.status === "running",
      })
    }

    if (node.children) {
      for (const child of node.children) {
        collect(child, node.id)
      }
    }
  }

  collect(rootNode)

  return { nodes, edges }
}
