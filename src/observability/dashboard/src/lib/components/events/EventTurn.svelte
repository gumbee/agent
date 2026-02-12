<script lang="ts">
  import { ChevronRight } from "@lucide/svelte"
  import type { Snippet } from "svelte"

  let {
    title,
    status,
    children,
  }: {
    title: string
    status: "start" | "active" | "completed" | "failed"
    children: Snippet
  } = $props()
</script>

<details class="group/turn border-b border-border-subtle last:border-0" open>
  <summary
    class="flex items-center justify-between px-5 py-2.5 bg-white hover:bg-surface-highlight cursor-pointer select-none sticky top-0 z-10 transition-colors border-b border-transparent group-open/turn:border-border-subtle/30"
  >
    <div class="flex items-center gap-2">
      <ChevronRight class="size-3 text-text-secondary group-open/turn:rotate-90 transition-transform duration-200" />
      <span class="text-xs font-medium text-text-main">{title}</span>
    </div>
    {#if status === "failed"}
      <span class="text-[9px] uppercase tracking-wider text-error font-bold">Failed</span>
    {:else if status === "active"}
      <span class="text-[9px] uppercase tracking-wider text-text-secondary font-medium">Active</span>
    {:else if status === "start"}
      <span class="text-[9px] uppercase tracking-wider text-text-secondary font-medium">Start</span>
    {:else}
      <span class="text-[9px] uppercase tracking-wider text-success font-medium">Completed</span>
    {/if}
  </summary>
  <div class="px-5 py-2 pb-4 space-y-1 bg-white">
    {@render children()}
  </div>
</details>
