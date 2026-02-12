<script lang="ts" module>
  import type { VirtualItem } from "@tanstack/virtual-core"
  import type { Snippet } from "svelte"

  export interface VirtualRowProps {
    virtualRow: VirtualItem
    measureElement: (node: Element) => void
    children: Snippet
  }
</script>

<script lang="ts">
  let { virtualRow, measureElement, children }: VirtualRowProps = $props()
</script>

<div
  data-index={virtualRow.index}
  use:measureElement
  style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({virtualRow.start}px);"
>
  {@render children()}
</div>
