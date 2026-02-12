<script lang="ts" module>
  import type { RuntimeYield } from "@gumbee/agent/graph"
  import type { Snippet } from "svelte"

  export interface EventItemSlotProps {
    type: string
    timestamp: Date
    formattedTime: string
    payload: Record<string, unknown>
    raw: RuntimeYield
    copyToClipboard: () => void
  }

  export interface EventItemProps {
    event: RuntimeYield
    children: Snippet<[EventItemSlotProps]>
  }
</script>

<script lang="ts">
  let { event, children }: EventItemProps = $props()

  const timestamp = $derived(new Date(event.timestamp))
  const formattedTime = $derived(timestamp.toLocaleTimeString())

  const payload = $derived.by(() => {
    // Remove path and timestamp for cleaner display
    const { path, timestamp, ...rest } = event as any
    return rest
  })

  function copyToClipboard() {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2))
  }
</script>

{@render children({
  type: event.type,
  timestamp,
  formattedTime,
  payload,
  raw: event,
  copyToClipboard,
})}
