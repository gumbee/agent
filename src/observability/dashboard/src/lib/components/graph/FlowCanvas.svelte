<script lang="ts">
  import GraphPanel from "./headless/GraphPanel.svelte"
  import AgentNode from "./AgentNode.svelte"
  import ToolNode from "./ToolNode.svelte"
  import RootNode from "./RootNode.svelte"
  import SmoothStepEdge from "./SmoothStepEdge.svelte"
  import type { Snippet } from "svelte"
  import type { GraphPanelSlotProps } from "./headless/GraphPanel.svelte"
  import { app } from "$lib/stores"

  let {
    children,
  }: {
    children?: Snippet<[GraphPanelSlotProps]>
  } = $props()

  const nodeTypes = {
    agent: AgentNode,
    tool: ToolNode,
    default: RootNode,
  }

  const edgeTypes = {
    smoothstep: SmoothStepEdge,
  }
</script>

<GraphPanel nodes={app.trace?.nodes ?? []} edges={app.trace?.edges ?? []} {nodeTypes} {edgeTypes} {children}></GraphPanel>
