<script lang="ts" module>
  import type { Node, Edge, NodeTypes, EdgeTypes } from "@xyflow/svelte"
  import type { ExecutionGraphNode } from "@gumbee/agent/graph"
  import type { Snippet } from "svelte"

  export interface GraphPanelSlotProps {
    nodes: Node[]
    edges: Edge[]
    selectedNode: Node | null
    selectedNodeData: ExecutionGraphNode | null
    clearSelection: () => void
  }

  export interface GraphPanelProps {
    nodes: Node[]
    edges: Edge[]
    nodeTypes?: NodeTypes
    edgeTypes?: EdgeTypes
    children?: Snippet<[GraphPanelSlotProps]>
  }
</script>

<script lang="ts">
  import { SvelteFlow, MiniMap, SvelteFlowProvider } from "@xyflow/svelte"
  import "@xyflow/svelte/dist/style.css"
  import { selection } from "$lib/stores"
  import NodeNavigator from "../NodeNavigator.svelte"

  let { nodes = [], edges = [], nodeTypes, edgeTypes, children }: GraphPanelProps = $props()

  const selectedNode = $derived(nodes.find((n) => n.id === selection.selectedNodeId) ?? null)
  const selectedNodeData = $derived((selectedNode?.data?.nodeData as ExecutionGraphNode) ?? null)

  const nodesWithSelection = $derived(
    nodes.map((n) => (n.selected === (n.id === selection.selectedNodeId) ? n : { ...n, selected: n.id === selection.selectedNodeId })),
  )

  function handleNodeClick(event: CustomEvent | { node: Node }) {
    // SvelteFlow event structure might vary, ensure we get the node
    const node = "node" in event ? event.node : (event as any).detail.node
    selection.selectNode(node.id)
  }

  function clearSelection() {
    selection.clearSelection()
  }
</script>

<div class="h-full w-full relative">
  <SvelteFlowProvider>
    <NodeNavigator />
    <SvelteFlow
      nodes={nodesWithSelection}
      {edges}
      {nodeTypes}
      {edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      class="bg-gray-50"
      defaultEdgeOptions={{ type: "step", style: "stroke-width: 1px;" }}
      onnodeclick={handleNodeClick}
      onpaneclick={clearSelection}
    >
      <!-- <Background /> -->
      <MiniMap />
    </SvelteFlow>

    <div class="absolute inset-0 pointer-events-none">
      {@render children?.({
        nodes,
        edges,
        selectedNode,
        selectedNodeData,
        clearSelection,
      })}
    </div>
  </SvelteFlowProvider>
</div>
