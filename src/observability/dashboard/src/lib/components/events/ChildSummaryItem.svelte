<script lang="ts">
  import type { ChildNodeSummary } from "./headless/EventList.svelte"
  import { ChevronRight, ChevronDown, Wrench, Bot, Loader2, CheckCircle, XCircle } from "@lucide/svelte"
  import EventItem from "./EventItem.svelte"
  import type { RuntimeYield } from "@gumbee/agent/graph"
  import { selection } from "$lib/stores"

  let { summary, onSelect }: { summary: ChildNodeSummary; onSelect: () => void } = $props()

  let expanded = $state(false)

  function toggleExpand(e: MouseEvent) {
    e.stopPropagation()
    expanded = !expanded
  }

  function handleSelect() {
    onSelect()
  }

  function handleMouseEnter() {
    selection.hoverNode(summary.childNode.id)
  }

  function handleMouseLeave() {
    selection.hoverNode(null)
  }

  const events = $derived("events" in summary.childNode ? (summary.childNode.events as RuntimeYield[]) : [])
  const nodeLabel = $derived(summary.nodeType === "tool" ? "tool call" : "agent")
  const formattedTime = $derived.by(() => {
    if (events.length === 0) return ""

    const start = new Date(events[0].timestamp).toLocaleTimeString()
    if (events.length === 1) return start

    const end = new Date(events[events.length - 1].timestamp).toLocaleTimeString()
    return start === end ? start : `${start} - ${end}`
  })
</script>

<div class="border-b border-border-subtle last:border-0">
  <div
    class="relative w-full mr-2 pl-4 py-1.5 rounded-sm bg-white cursor-pointer group transition-colors select-none hover:bg-surface-highlight/60"
    role="button"
    tabindex="0"
    onclick={handleSelect}
    onkeydown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect()}
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
  >
    <div class="absolute left-1 top-0 bottom-0 w-px bg-border-subtle"></div>
    <button
      class="absolute -left-1.5 top-1 p-1 rounded bg-white hover:bg-surface-highlight text-text-secondary hover:text-text-main transition-colors"
      onclick={toggleExpand}
      aria-label={expanded ? "Collapse child events" : "Expand child events"}
    >
      {#if expanded}
        <ChevronDown class="size-2.5" />
      {:else}
        <ChevronRight class="size-2.5" />
      {/if}
    </button>

    <div class="flex items-start justify-between gap-3 pb-[6px]">
      <div class="min-w-0 flex-1">
        <div class="flex items-center min-w-0 gap-2">
          <div class="inline-flex items-center gap-1 text-[11px] font-medium text-text-main min-w-0 truncate">
            {#if summary.nodeType === "tool"}
              <Wrench class="size-2.5 text-text-secondary shrink-0" />
            {:else}
              <Bot class="size-2.5 text-text-secondary shrink-0" />
            {/if}
            <span class="font-mono text-[11px]">{summary.name}</span>
          </div>
          {#if !expanded}
            <span class="text-[10px] text-text-secondary whitespace-nowrap">{summary.eventCount} events</span>
          {/if}
        </div>
        {#if !expanded && formattedTime}
          <div class="text-[10px] text-text-secondary truncate">{formattedTime}</div>
        {/if}
      </div>

      <div class="flex items-center text-text-secondary shrink-0">
        {#if summary.status === "running"}
          <Loader2 class="size-3 animate-spin text-blue-500 shrink-0" />
        {:else if summary.status === "completed"}
          <CheckCircle class="size-3 text-success shrink-0" />
        {:else if summary.status === "failed"}
          <XCircle class="size-3 text-error shrink-0" />
        {/if}
      </div>
    </div>
  </div>

  {#if expanded}
    <div class="pl-4">
      {#each events as event}
        <EventItem {event} />
      {/each}
    </div>
  {/if}
</div>
