<script lang="ts">
  import { Plus, Minus, Scan } from "@lucide/svelte"
  import TraceSelector from "./TraceSelector.svelte"
  import { useSvelteFlow } from "@xyflow/svelte"
  import { app } from "$lib/stores"

  const { zoomIn, zoomOut, fitView } = useSvelteFlow()
</script>

<div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
  <div class="bg-white/90 backdrop-blur-md border border-border-strong rounded-full shadow-pill flex items-center px-4 py-2 gap-6 h-12">
    <div class="flex items-center gap-2.5">
      <span class="material-symbols-outlined text-text-main" style="font-size: 18px;">hub</span>
      <span class="text-xs font-semibold tracking-tight text-text-main">AgentObserver</span>
    </div>

    <div class="h-4 w-px bg-border-strong"></div>

    <TraceSelector traces={app.traces} activeTraceId={app.activeTraceId} onSelect={(id) => app.selectTrace(id)} />

    <div class="h-4 w-px bg-border-strong"></div>

    <div class="flex items-center gap-1">
      <button
        class="flex items-center justify-center size-8 rounded-full hover:bg-gray-50 text-text-secondary hover:text-text-main transition-colors"
        title="Zoom In"
        onclick={() => zoomIn()}
      >
        <Plus class="size-4" />
      </button>
      <button
        class="flex items-center justify-center size-8 rounded-full hover:bg-gray-50 text-text-secondary hover:text-text-main transition-colors"
        title="Zoom Out"
        onclick={() => zoomOut()}
      >
        <Minus class="size-4" />
      </button>
      <button
        class="flex items-center justify-center size-8 rounded-full hover:bg-gray-50 text-text-secondary hover:text-text-main transition-colors"
        title="Fit to Screen"
        onclick={() => fitView({ padding: 0.3 })}
      >
        <Scan class="size-4" />
      </button>
    </div>
  </div>
</div>
