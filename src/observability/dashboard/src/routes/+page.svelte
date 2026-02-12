<script lang="ts">
  import { SvelteFlowProvider } from "@xyflow/svelte"
  import TraceView from "$lib/views/TraceView.svelte"
</script>

<main class="absolute inset-0 bg-surface overflow-hidden">
  <SvelteFlowProvider>
    <TraceView />
  </SvelteFlowProvider>
</main>
