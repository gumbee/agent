<script lang="ts">
  import { formatDuration } from "$lib/utils/format"
  import { onDestroy } from "svelte"

  let { startTime }: { startTime: number } = $props()

  let now = $state(Date.now())

  const interval = setInterval(() => {
    now = Date.now()
  }, 100)

  onDestroy(() => clearInterval(interval))

  let elapsed = $derived(now - startTime)
</script>

<span class="absolute left-[14px] top-[calc(100%+4px)] text-[9px] text-text-secondary font-mono whitespace-nowrap">
  {formatDuration(elapsed)}
</span>
