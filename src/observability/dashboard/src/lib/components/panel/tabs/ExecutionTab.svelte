<script lang="ts">
  import { app } from "$lib/stores"
  import AgentDetail from "./AgentDetail.svelte"
  import ToolDetail from "./ToolDetail.svelte"

  const node = $derived(app.selectedNode)
</script>

<div class="h-full overflow-y-auto bg-surface-base">
  {#if !node}
    <div class="flex h-full items-center justify-center p-8 text-text-secondary italic text-xs">No node selected</div>
  {:else if node.type === "agent"}
    <AgentDetail node={node} />
  {:else if node.type === "tool"}
    <ToolDetail node={node} />
  {:else}
    <div class="flex h-full items-center justify-center p-8 text-text-secondary italic text-xs">
      Node type <span class="mx-1 font-mono">{node.type}</span> is not yet supported.
    </div>
  {/if}
</div>
