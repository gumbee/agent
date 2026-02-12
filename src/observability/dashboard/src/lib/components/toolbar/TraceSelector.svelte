<script lang="ts">
  import type { TraceInfo } from "@gumbee/agent/observability"
  import { CheckCircle, XCircle, Loader2, Clock, ChevronUp } from "@lucide/svelte"

  let {
    traces,
    activeTraceId,
    onSelect,
  }: {
    traces: TraceInfo[]
    activeTraceId: string | null
    onSelect: (id: string) => void
  } = $props()

  let open = $state(false)
  let containerRef: HTMLDivElement

  function toggle() {
    open = !open
  }

  function select(id: string) {
    onSelect(id)
    open = false
  }

  // Close on click outside
  function handleClickOutside(event: MouseEvent) {
    if (containerRef && !containerRef.contains(event.target as Node)) {
      open = false
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  })

  const activeTrace = $derived(traces.find((t) => t.id === activeTraceId))
</script>

<div class="relative" bind:this={containerRef}>
  <button class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded-full transition-colors text-text-main" onclick={toggle}>
    <span class="text-xs font-semibold tracking-tight">
      {activeTrace ? activeTrace.name : "Select Trace"}
    </span>
    <span class="text-[10px] font-mono text-text-secondary">
      {activeTrace ? activeTrace.id.slice(0, 6) : ""}
    </span>
    <ChevronUp class="size-3 text-text-secondary transition-transform {open ? 'rotate-180' : ''}" />
  </button>

  {#if open}
    <div
      class="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-float border border-border-strong overflow-hidden z-50 max-h-[300px] overflow-y-auto"
    >
      <div class="p-2 space-y-0.5">
        {#each traces as trace}
          <button
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-highlight transition-colors text-left {activeTraceId ===
            trace.id
              ? 'bg-surface-highlight'
              : ''}"
            onclick={() => select(trace.id)}
          >
            {#if trace.status === "completed"}
              <CheckCircle class="size-3.5 text-success shrink-0" />
            {:else if trace.status === "failed"}
              <XCircle class="size-3.5 text-error shrink-0" />
            {:else if trace.status === "running"}
              <Loader2 class="size-3.5 text-blue-500 animate-spin shrink-0" />
            {:else}
              <Clock class="size-3.5 text-gray-400 shrink-0" />
            {/if}
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-text-main truncate">{trace.name}</span>
                <span class="text-[10px] font-mono text-text-secondary">{trace.id.slice(0, 6)}</span>
              </div>
              <div class="text-[10px] text-text-secondary">
                {new Date(trace.startTime).toLocaleTimeString()}
              </div>
            </div>
          </button>
        {/each}
        {#if traces.length === 0}
          <div class="px-3 py-4 text-center text-xs text-text-secondary">No traces found</div>
        {/if}
      </div>
    </div>
  {/if}
</div>
