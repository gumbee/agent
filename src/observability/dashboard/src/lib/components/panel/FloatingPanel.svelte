<script lang="ts">
  import type { Snippet } from "svelte"
  import { selection } from "$lib/stores"

  let { children }: { children: Snippet } = $props()
</script>

{#if selection.panelOpen}
  <div
    class="absolute right-8 top-8 bottom-8 w-[360px] bg-white rounded-2xl shadow-float border border-border-strong flex flex-col z-20 overflow-hidden"
  >
    {@render children()}
  </div>
{/if}
