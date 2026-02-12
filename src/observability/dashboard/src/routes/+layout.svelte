<script lang="ts">
  import "../app.css"
  import { Tooltip } from "bits-ui"

  import type { Snippet } from "svelte"

  let { children }: { children: Snippet } = $props()
</script>

<div class="h-screen w-full overflow-hidden bg-surface text-text-main font-display antialiased selection:bg-gray-100 selection:text-black">
  <Tooltip.Provider delayDuration={200}>
    {@render children()}
  </Tooltip.Provider>
</div>
