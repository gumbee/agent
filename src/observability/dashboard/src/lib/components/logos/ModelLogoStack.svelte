<script lang="ts">
  import ModelLogo from "./ModelLogo.svelte"
  import Tooltip from "../ui/tooltip/Tooltip.svelte"

  type ModelEntry = {
    modelId: string
    provider: string
  }

  type Props = {
    models: ModelEntry[]
    size?: number
  }

  let { models, size = 20 }: Props = $props()
  const MAX_VISIBLE_MODELS = 5

  const uniqueModels = $derived.by(() => {
    const seen = new Set<string>()

    return models.filter((model) => {
      const key = `${model.provider}:${model.modelId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })
  const visibleModels = $derived(uniqueModels.slice(0, MAX_VISIBLE_MODELS))
  const hiddenCount = $derived(Math.max(uniqueModels.length - MAX_VISIBLE_MODELS, 0))

  const iconSize = $derived(Math.max(size - 4, 10))
</script>

<div class="model-stack-root flex w-full items-center justify-end">
  <div class="model-stack flex items-center justify-end">
    {#each visibleModels as model, index (`${model.provider}:${model.modelId}`)}
      <Tooltip text={`${model.modelId}`} side="top" sideOffset={6}>
        <div
          class={`model-chip flex items-center justify-center rounded-full border-[0.5px] border-black/16 bg-white ${index > 0 ? "model-chip-overlap" : ""}`}
          style={`width:${size}px;height:${size}px;z-index:${visibleModels.length + hiddenCount - index};`}
        >
          <ModelLogo provider={model.provider} modelId={model.modelId} size={iconSize} fallbackFill />
        </div>
      </Tooltip>
    {/each}

    {#if hiddenCount > 0}
      <Tooltip text={`${hiddenCount} more model${hiddenCount === 1 ? "" : "s"}`} side="top" sideOffset={6}>
        <div
          class={`model-chip flex items-center justify-center rounded-full border-[0.5px] border-black/6 bg-surface-main text-[8px] font-semibold text-text-secondary shadow-[0_1px_2px_rgba(0,0,0,0.1)] ${visibleModels.length > 0 ? "model-chip-overlap" : ""}`}
          style={`width:${size}px;height:${size}px;z-index:${hiddenCount};`}
        >
          +{hiddenCount}
        </div>
      </Tooltip>
    {/if}
  </div>
</div>

<style>
  .model-chip {
    transition: margin-left 180ms ease;
  }

  .model-chip-overlap {
    margin-left: -8px;
  }

  .model-stack-root:hover .model-chip-overlap {
    margin-left: 2px;
  }
</style>
