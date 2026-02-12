<script lang="ts">
  import { formatTokens } from "$lib/utils/format"

  let {
    value,
    class: className = "",
    maxDurationMs = 2000,
    speed = 0.5,
  }: {
    value: number
    class?: string
    maxDurationMs?: number
    speed?: number
  } = $props()

  let displayedValue = $state(Math.max(0, Math.round(value)))
  let frameId: number | undefined

  function stopAnimation() {
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId)
      frameId = undefined
    }
  }

  $effect(() => {
    const target = Math.max(0, Math.round(value))
    const start = displayedValue

    if (target === start) {
      return
    }

    if (target < start) {
      stopAnimation()
      displayedValue = target
      return
    }

    const delta = target - start
    const speedFactor = Number.isFinite(speed) && speed > 0 ? speed : 1
    const duration = Math.min(maxDurationMs, Math.max(140, Math.sqrt(delta) * 22) / speedFactor)
    const startAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      displayedValue = Math.round(start + delta * eased)

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
        return
      }

      displayedValue = target
      frameId = undefined
    }

    stopAnimation()
    frameId = requestAnimationFrame(tick)

    return () => {
      stopAnimation()
    }
  })
</script>

<span class={className}>{formatTokens(displayedValue)}</span>
