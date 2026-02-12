<script lang="ts">
  import HeadlessAgentNode from "./headless/AgentNode.svelte"
  import { AlertCircle, Bot, Brain, Check, Coins, Cpu, RefreshCw } from "@lucide/svelte"
  import { fade } from "svelte/transition"
  import { formatDuration, formatTokens } from "$lib/utils/format"
  import RunningTimer from "./RunningTimer.svelte"
  import { selection } from "$lib/stores"
  import AnimatedTokenCount from "$lib/components/ui/AnimatedTokenCount.svelte"
  import ModelLogo from "$lib/components/logos/ModelLogo.svelte"

  let { data, selected } = $props()

  const hovered = $derived(selection.hoveredNodeId === data.nodeData.id)
</script>

<HeadlessAgentNode {data} {selected}>
  {#snippet children({ name, status, modelId, provider, usage, thinking, events })}
    {@const startTime = events.length > 0 ? events[0].timestamp : undefined}
    {@const endTime = (status === "completed" || status === "failed") && events.length > 1 ? events[events.length - 1].timestamp : undefined}
    {@const hasCacheUsage = (usage?.cacheReadTokens ?? 0) > 0 || (usage?.cacheWriteTokens ?? 0) > 0}

    <div class="relative w-64">
      {#if status === "running"}
        <div class="absolute inset-0 pointer-events-none z-20" transition:fade={{ duration: 200 }}>
          <!-- HUD Corners -->
          <div class="absolute -inset-[3px] border border-[rgba(59,130,246,0.8)] rounded-[13px]"></div>

          <!-- Scanline Effect -->
          <div class="absolute inset-0 rounded-xl overflow-hidden">
            <div
              class="absolute -inset-[200%] w-[500%] h-[500%] bg-[linear-gradient(45deg,transparent_42%,rgba(59,130,246,0.05)_45%,rgba(59,130,246,0.05)_50%,transparent_53%)] animate-shimmer"
            ></div>
          </div>
        </div>
      {/if}

      {#if hovered}
        <div class="absolute inset-0 pointer-events-none z-30 rounded-[10px] border-2 border-yellow-500" transition:fade={{ duration: 150 }}></div>
      {/if}

      <div
        class="relative z-10 bg-surface border transition-all duration-200 rounded-[10px] flex flex-col overflow-hidden group {selected
          ? 'border-primary'
          : 'border-primary/20 hover:border-primary/50 hover:shadow-soft'}"
      >
        <!-- Header Section -->
        <div class="p-3 flex items-center gap-3 border-b border-border-subtle/50 bg-surface-highlight/30">
          <div class="size-9 flex items-center justify-center text-text-secondary shrink-0">
            <ModelLogo {provider} {modelId} size={26} />
          </div>

          <div class="flex-1 min-w-0 flex flex-col justify-center gap-[1px]">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold text-text-main truncate leading-tight">{name}</span>
              <!-- Status Indicator -->
              {#if status === "running"}
                <RefreshCw class="size-3.5 text-primary animate-spin" />
              {:else if status === "completed"}
                <Check class="size-3.5 text-success" />
              {:else if status === "failed"}
                <AlertCircle class="size-3.5 text-error" />
              {:else}
                <div class="size-2.5 rounded-full bg-gray-300"></div>
              {/if}
            </div>
            <span class="text-[9px] text-text-secondary font-medium uppercase tracking-wider">Agent</span>
          </div>
        </div>

        <!-- Content Section -->
        {#if modelId || thinking?.enabled || usage}
          <div class="p-3 grid grid-cols-2 gap-2 bg-surface">
            <!-- Model Info -->
            {#if modelId}
              <div class="col-span-2 flex items-start gap-2.5 p-2 rounded-lg bg-surface-highlight">
                <Cpu class="size-3.5 text-text-secondary shrink-0" />
                <div class="flex flex-col leading-none gap-1 min-w-0">
                  <span class="text-[9px] text-text-secondary uppercase tracking-wider font-medium">Model</span>
                  <span class="text-xs text-text-main font-medium truncate">{modelId}</span>
                </div>
              </div>
            {/if}

            <!-- Usage Stats -->
            <div class="flex items-start gap-2 p-2 rounded-lg">
              <Coins class="size-3.5 text-text-secondary shrink-0" />
              <div class="flex flex-col leading-none gap-1">
                <span class="text-[9px] text-text-secondary uppercase tracking-wider font-medium">Tokens</span>
                <AnimatedTokenCount value={usage?.totalTokens ?? 0} class="text-xs text-text-main font-mono" />
                {#if hasCacheUsage}
                  <span class="text-[9px] text-text-secondary font-mono">
                    C {formatTokens((usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0))}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Thinking Stats -->
            {#if thinking?.enabled}
              <div class="flex items-start gap-2 p-2 rounded-lg">
                <Brain class="size-3.5 text-text-secondary shrink-0" />
                <div class="flex flex-col leading-none gap-1">
                  <span class="text-[9px] text-text-secondary uppercase tracking-wider font-medium">Thinking</span>
                  <span class="text-xs text-text-main capitalize">{thinking.level || "Default"}</span>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Runtime / Execution Time -->
      {#if startTime !== undefined}
        {#if status === "running"}
          <RunningTimer {startTime} />
        {:else if endTime !== undefined}
          <span class="absolute left-[10px] top-[calc(100%+4px)] text-[9px] text-text-secondary font-mono whitespace-nowrap">
            {formatDuration(endTime - startTime)}
          </span>
        {/if}
      {/if}
    </div>
  {/snippet}
</HeadlessAgentNode>

<style>
  .animate-shimmer {
    animation: shimmer 2.5s infinite linear;
  }
  @keyframes shimmer {
    0% {
      transform: translateX(-50%);
    }
    100% {
      transform: translateX(50%);
    }
  }
</style>
