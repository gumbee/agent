<script lang="ts">
  import HeadlessRootNode from "./headless/RootNode.svelte"
  import { TreeDeciduous } from "@lucide/svelte"
  import { calculateTreeCost, formatCost } from "$lib/utils/pricing"

  let { data, selected } = $props()

  const totalCost = $derived.by(() => {
    const cost = calculateTreeCost(data.nodeData)
    return cost > 0 ? formatCost(cost) : null
  })
</script>

<HeadlessRootNode {data} {selected}>
  {#snippet children({ name: _name, status: _status })}
    <div class="flex flex-col items-center gap-2">
      <div
        class="size-9 rounded-lg bg-white flex items-center justify-center text-text-secondary {selected
          ? 'ring-2 ring-blue-400 border-blue-400'
          : ''}"
      >
        <TreeDeciduous class="size-5" />
      </div>
      <div class="absolute -bottom-[4px] translate-y-full flex flex-col items-center gap-0.5">
        <span class="text-[9px] text-text-secondary font-medium tracking-widest uppercase">Root</span>
        {#if totalCost}
          <span class="text-[9px] text-text-secondary/70 font-mono">{totalCost}</span>
        {/if}
      </div>
    </div>
  {/snippet}
</HeadlessRootNode>
