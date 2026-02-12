<script lang="ts">
  import type { TraceStatus } from "@gumbee/agent/observability"

  let { status }: { status: TraceStatus } = $props()
</script>

<div class="absolute top-8 left-1/2 -translate-x-1/2 z-10">
  <div class="bg-white/80 backdrop-blur-sm border border-border-strong rounded-full flex items-center px-3 py-1.5 shadow-soft gap-2">
    {#if status === "running"}
      <span class="size-1.5 rounded-full bg-blue-500 animate-pulse"></span>
      <span class="text-[10px] font-medium text-text-main tracking-wide uppercase">Running</span>
    {:else if status === "completed"}
      <span class="size-1.5 rounded-full bg-success"></span>
      <span class="text-[10px] font-medium text-text-main tracking-wide uppercase">Completed</span>
    {:else if status === "failed"}
      <span class="size-1.5 rounded-full bg-error animate-pulse"></span>
      <span class="text-[10px] font-medium text-text-main tracking-wide uppercase">Failed</span>
    {:else}
      <span class="size-1.5 rounded-full bg-gray-400"></span>
      <span class="text-[10px] font-medium text-text-main tracking-wide uppercase">Pending</span>
    {/if}
  </div>
</div>
