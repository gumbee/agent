<script lang="ts">
  import EventList from "./headless/EventList.svelte"
  import VirtualRow from "./headless/VirtualRow.svelte"
  import EventItem from "./EventItem.svelte"
  import ChildSummaryItem from "./ChildSummaryItem.svelte"
  import type { RuntimeYield } from "@gumbee/agent/graph"
  import type { StepHeader } from "./headless/EventList.svelte"
  import type { VirtualItem } from "@tanstack/virtual-core"
  import { app, selection } from "$lib/stores"
  import { attachScrollBottom } from "$lib/actions/attachScrollBottom.svelte"
  import { Loader2, CheckCircle, XCircle } from "@lucide/svelte"

  let {
    events = [],
    onClearFilter,
  }: {
    events?: RuntimeYield[]
    onClearFilter?: () => void
  } = $props()

  let scrollTop = $state(0)

  function handleScroll(event: Event) {
    scrollTop = (event.currentTarget as HTMLElement).scrollTop
  }

  function isStepHeader(item: unknown): item is StepHeader {
    return typeof item === "object" && item !== null && "kind" in item && (item as { kind?: string }).kind === "step-header"
  }

  function getActiveStepHeader(items: unknown[], virtualItems: VirtualItem[], currentScrollTop: number): StepHeader | null {
    if (virtualItems.length === 0) return null

    // Use viewport anchor (not overscan index) so sticky header switches at the right time.
    const viewportItem = virtualItems.find((row) => row.start + row.size + 2 + 30 > currentScrollTop)
    const anchorIndex = viewportItem?.index ?? virtualItems[0]?.index ?? 0

    // Prefer the closest step header at or before viewport anchor.
    for (let i = anchorIndex; i >= 0; i--) {
      const candidate = items[i]
      if (isStepHeader(candidate)) {
        return candidate
      }
    }

    return null
  }
</script>

{#snippet stepHeaderContent(header: StepHeader)}
  <div class="flex items-center justify-between gap-3">
    <div class="text-[10px] font-semibold uppercase tracking-wider text-text-main">Step {header.step}</div>
    <div class="flex items-center gap-2 text-[10px] text-text-secondary min-w-0">
      {#if header.modelId}
        <span class="font-mono truncate max-w-[240px]">{header.modelId}</span>
      {/if}
      {#if header.status === "running"}
        <Loader2 class="size-3 text-blue-500 animate-spin shrink-0" />
      {:else if header.status === "completed"}
        <CheckCircle class="size-3 text-success shrink-0" />
      {:else}
        <XCircle class="size-3 text-error shrink-0" />
      {/if}
    </div>
  </div>
{/snippet}

<EventList {events} selectedNode={app.selectedNode} {onClearFilter} onSelectNode={(id) => selection.selectNode(id, { navigate: true })}>
  {#snippet children({ events, virtualItems, totalSize, measureElement, scrollAction, onSelectNode })}
    <div class="bg-white h-full overflow-y-auto" use:scrollAction use:attachScrollBottom onscroll={handleScroll}>
      {#if events.length === 0}
        <div class="text-xs text-text-secondary italic px-5 py-4">No events recorded</div>
      {:else}
        {@const activeStepHeader = getActiveStepHeader(events as unknown[], virtualItems, scrollTop)}
        <div
          class={`sticky top-0 z-30 h-[34px] -mb-[34px] px-5 py-2.5 pointer-events-none ${activeStepHeader ? "bg-white border-b border-border-subtle pointer-events-auto" : ""}`}
        >
          {#if activeStepHeader}
            {@render stepHeaderContent(activeStepHeader)}
          {/if}
        </div>
        <div style="height: {totalSize}px; width: 100%; position: relative;">
          {#each virtualItems as virtualRow (virtualRow.key)}
            {@const item = events[virtualRow.index]}
            <VirtualRow {virtualRow} {measureElement}>
              <div class="px-5 py-0.5">
                {#if item}
                  {#if "kind" in item && item.kind === "step-header"}
                    {@const header = item as StepHeader}
                    <div class="-mx-5 px-5 pt-10 pb-2.5 bg-surface-secondary/70 border-b border-border-subtle">
                      {@render stepHeaderContent(header)}
                    </div>
                  {:else if "kind" in item && item.kind === "child-summary"}
                    <ChildSummaryItem summary={item} onSelect={() => onSelectNode?.(item.childNode.id)} />
                  {:else}
                    <EventItem event={item as RuntimeYield} />
                  {/if}
                {/if}
              </div>
            </VirtualRow>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}
</EventList>
