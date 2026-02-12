<script lang="ts">
  import { app } from "$lib/stores"
  import FlowCanvas from "$lib/components/graph/FlowCanvas.svelte"
  import StatusBadge from "$lib/components/ui/StatusBadge.svelte"
  import FloatingPanel from "$lib/components/panel/FloatingPanel.svelte"
  import NodeDetailPanel from "$lib/components/panel/NodeDetailPanel.svelte"
  import FloatingToolbar from "$lib/components/toolbar/FloatingToolbar.svelte"

  $effect(() => {
    app.connect()

    return () => app.destroy()
  })
</script>

<div class="absolute inset-0 bg-surface overflow-hidden">
  <!-- Status Badge -->
  {#if app.activeTrace}
    <StatusBadge status={app.activeTrace.status} />
  {/if}

  <!-- Graph Area -->
  <div class="w-full h-full relative graph-bg overflow-hidden">
    <div class="absolute inset-0 pointer-events-none graph-gradient z-0"></div>

    <FlowCanvas>
      <FloatingToolbar />
    </FlowCanvas>
  </div>

  <!-- Floating Panel -->
  <FloatingPanel>
    {#if app.selectedNode}
      <NodeDetailPanel />
    {/if}
  </FloatingPanel>
</div>
