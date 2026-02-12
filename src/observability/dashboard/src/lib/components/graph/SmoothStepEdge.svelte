<script lang="ts">
  import { getSmoothStepPath, BaseEdge } from "@xyflow/svelte"
  import type { EdgeProps } from "@xyflow/svelte"

  let {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    style,
    ...rest
  }: EdgeProps = $props()

  const [path] = $derived(
    getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 20,
    }),
  )
</script>

<BaseEdge {path} {style} />
