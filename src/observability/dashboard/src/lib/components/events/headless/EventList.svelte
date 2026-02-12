<script lang="ts" module>
  import type { RuntimeYield, ExecutionGraphNode, NodeStatus } from "@gumbee/agent/graph"
  import type { Snippet } from "svelte"
  import type { VirtualItem } from "@tanstack/virtual-core"
  import type { Action } from "svelte/action"

  export interface ChildNodeSummary {
    kind: "child-summary"
    childNode: ExecutionGraphNode
    name: string
    nodeType: "tool" | "agent" | "unknown"
    eventCount: number
    status: NodeStatus
    timestamp: number
  }

  export interface StepHeader {
    kind: "step-header"
    step: number
    status: "running" | "completed" | "failed"
    modelId?: string
    timestamp: number
  }

  export type DisplayItem = RuntimeYield | ChildNodeSummary | StepHeader

  export interface EventListSlotProps {
    events: DisplayItem[]
    count: number
    isFiltered: boolean
    clearFilter: () => void
    onSelectNode?: (id: string) => void
    virtualItems: VirtualItem[]
    totalSize: number
    measureElement: (node: Element) => void
    scrollAction: Action<HTMLElement>
  }

  export interface EventListProps {
    events: RuntimeYield[]
    selectedNode?: ExecutionGraphNode | null
    estimateSize?: number
    overscan?: number
    onClearFilter?: () => void
    onSelectNode?: (id: string) => void
    children: Snippet<[EventListSlotProps]>
  }
</script>

<script lang="ts">
  import { createVirtualizer } from "$lib/utils/createVirtualizer.svelte"

  let { events = [], selectedNode = null, estimateSize = 60, overscan = 10, onClearFilter, onSelectNode, children }: EventListProps = $props()

  function isStepHeader(item: DisplayItem): item is StepHeader {
    return "kind" in item && item.kind === "step-header"
  }

  /** Sorts by timestamp, preserving original relative order for equal timestamps. */
  function stableTimestampSort<T extends { timestamp: number }>(items: T[]): T[] {
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => a.item.timestamp - b.item.timestamp || a.index - b.index)
      .map(({ item }) => item)
  }

  const displayEvents = $derived.by(() => {
    if (selectedNode && "events" in selectedNode) {
      const ownEvents = (selectedNode.events as any[]) || []
      const childNodes = selectedNode.children || []

      const childSummaries: ChildNodeSummary[] = childNodes
        .map((child) => {
          // Find the first event to use as timestamp
          let firstEvent: RuntimeYield | undefined
          let eventCount = 0

          if ("events" in child && Array.isArray(child.events) && child.events.length > 0) {
            firstEvent = child.events[0] as RuntimeYield
            eventCount = child.events.length
          }

          if (!firstEvent) return null

          return {
            kind: "child-summary",
            childNode: child,
            name: child.name || "Unknown",
            nodeType: child.type === "root" ? "unknown" : child.type,
            eventCount,
            status: child.status,
            timestamp: firstEvent.timestamp,
          }
        })
        .filter((s): s is ChildNodeSummary => s !== null)

      const allItems = stableTimestampSort([...ownEvents, ...childSummaries])

      if (selectedNode.type === "agent") {
        const stepBegins = stableTimestampSort(ownEvents.filter((event) => event?.type === "agent-step-begin"))

        if (stepBegins.length > 0) {
          const stepHeaders: StepHeader[] = stepBegins.map((stepBegin, index) => {
            const stepEnd = ownEvents.find((event) => event?.type === "agent-step-end" && event.step === stepBegin.step)
            const stepError = ownEvents.find((event) => event?.type === "agent-error" && event.step === stepBegin.step)
            const stepModelCall = ownEvents.find((event) => event?.type === "agent-step-llm-call" && event.step === stepBegin.step)

            return {
              kind: "step-header",
              step: Number(stepBegin.step ?? index),
              status: stepError ? "failed" : stepEnd ? "completed" : "running",
              modelId: stepModelCall?.modelId,
              timestamp: stepBegin.timestamp,
            }
          })

          // Insert each step header right before its matching agent-step-begin event
          const mergedItems: DisplayItem[] = [...allItems]
          for (const header of stepHeaders) {
            const insertIndex = mergedItems.findIndex(
              (item) => !isStepHeader(item) && "type" in item && item.type === "agent-step-begin" && "step" in item && item.step === header.step,
            )
            if (insertIndex !== -1) {
              mergedItems.splice(insertIndex, 0, header)
            } else {
              // Fallback: append at the end if no matching step-begin found
              mergedItems.push(header)
            }
          }

          return mergedItems
        }
      }

      return allItems
    }
    return events
  })

  let scrollElement = $state<HTMLElement | null>(null)

  const scrollAction: Action<HTMLElement> = (node) => {
    scrollElement = node
    return {
      destroy() {
        if (scrollElement === node) {
          scrollElement = null
        }
      },
    }
  }

  const rowVirtualizer = createVirtualizer({
    get count() {
      return displayEvents.length
    },
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateSize,
    get overscan() {
      return overscan
    },
  })
</script>

{@render children({
  events: displayEvents,
  count: displayEvents.length,
  isFiltered: !!selectedNode,
  clearFilter: () => onClearFilter?.(),
  onSelectNode,
  virtualItems: rowVirtualizer.getVirtualItems(),
  totalSize: rowVirtualizer.getTotalSize(),
  measureElement: rowVirtualizer.measureElement,
  scrollAction,
})}
