<script lang="ts">
  import PanelHeader from "./PanelHeader.svelte"
  import PanelTabs from "./PanelTabs.svelte"
  import PanelFooter from "./PanelFooter.svelte"
  import ExecutionTab from "./tabs/ExecutionTab.svelte"
  import EventsTab from "./tabs/EventsTab.svelte"
  import { app, selection } from "$lib/stores"
  import { formatTokens } from "$lib/utils/format"
  import { calculateCost, formatCost } from "$lib/utils/pricing"

  // No props needed!

  const tokens = $derived.by(() => {
    const node = app.selectedNode
    if (node?.type === "agent" && node.usage) {
      return formatTokens(node.usage.totalTokens)
    }
    return "-"
  })

  const cost = $derived.by(() => {
    const node = app.selectedNode
    if (node?.type === "agent" && node.usage) {
      return formatCost(calculateCost(node.provider, node.modelId, node.usage))
    }
    return "-"
  })

  const eventsCount = $derived.by(() => {
    const node = app.selectedNode
    if (node?.type === "agent" || node?.type === "tool") {
      return node.events?.length
    }
    return 0
  })
</script>

<PanelHeader
  title="Contextual Data"
  subtitle={`ID: <span class="text-text-main">${app.selectedNode?.id.slice(0, 6)}</span> <span class="text-border-strong">|</span> ${app.selectedNode?.type}`}
  onClose={() => selection.closePanel()}
/>

<PanelTabs
  tabs={[
    { id: "execution", label: "Execution" },
    { id: "events", label: `Events (${eventsCount})` },
  ]}
  activeTab={selection.activeTab}
  onTabChange={(id) => selection.setTab(id)}
/>

<div class="flex-1 min-h-0 bg-white relative scrollbar-hide">
  {#if selection.activeTab === "execution"}
    <ExecutionTab />
  {:else}
    <EventsTab />
  {/if}
</div>

<PanelFooter
  stats={[
    { label: "Tokens", value: tokens },
    { label: "Cost", value: cost },
    {
      label: "Duration",
      value: app.activeTrace?.endTime ? `${((app.activeTrace.endTime - app.activeTrace.startTime) / 1000).toFixed(2)}s` : "...",
    },
  ]}
/>
