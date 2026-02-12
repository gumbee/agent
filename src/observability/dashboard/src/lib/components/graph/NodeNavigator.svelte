<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte"
  import { selection } from "$lib/stores"

  const { fitView } = useSvelteFlow()

  $effect(() => {
    const nodeId = selection.pendingFitNodeId
    if (nodeId) {
      fitView({ nodes: [{ id: nodeId }], duration: 200, padding: 0.5, maxZoom: 1.5 })
      selection.acknowledgeFit()
    }
  })
</script>
