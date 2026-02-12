<script lang="ts">
  import HeadlessToolNode from "./headless/ToolNode.svelte"
  import {
    AlertCircle,
    Braces,
    Check,
    CreditCard,
    Database,
    FileJson,
    Globe,
    LayoutGrid,
    MessageSquare,
    RefreshCw,
    Search,
    ShieldCheck,
    Wrench,
  } from "@lucide/svelte"
  import { fade } from "svelte/transition"
  import { formatDuration } from "$lib/utils/format"
  import RunningTimer from "./RunningTimer.svelte"
  import { selection } from "$lib/stores"

  let { data, selected } = $props()

  const hovered = $derived(selection.hoveredNodeId === data.nodeData.id)

  // Pick an icon by matching common tool naming patterns.
  function getIcon(name: string) {
    const n = name.toLowerCase()
    if (n.includes("widget") || n.includes("ui") || n.includes("component")) return LayoutGrid
    if (n.includes("schema") || n.includes("json") || n.includes("parse")) return FileJson
    if (n.includes("validate") || n.includes("type") || n.includes("zod")) return Braces
    if (n.includes("db") || n.includes("database") || n.includes("sql") || n.includes("table")) return Database
    if (n.includes("api") || n.includes("http") || n.includes("fetch") || n.includes("request")) return Globe
    if (n.includes("auth") || n.includes("token") || n.includes("permission") || n.includes("security")) return ShieldCheck
    if (n.includes("chat") || n.includes("message") || n.includes("prompt")) return MessageSquare
    if (n.includes("stripe") || n.includes("payment") || n.includes("card") || n.includes("billing")) return CreditCard
    if (n.includes("search") || n.includes("find") || n.includes("query") || n.includes("lookup")) return Search
    return Wrench
  }
</script>

<HeadlessToolNode {data} {selected}>
  {#snippet children({ name, status, error, events })}
    {@const Icon = getIcon(name)}
    {@const startTime = events.length > 0 ? events[0].timestamp : undefined}
    {@const endTime = (status === "completed" || status === "failed") && events.length > 1 ? events[events.length - 1].timestamp : undefined}

    <div class="relative min-w-[120px] max-w-[180px]">
      {#if status === "running"}
        <div class="absolute inset-0 pointer-events-none z-20" transition:fade={{ duration: 200 }}>
          <!-- HUD Corners -->
          <div class="absolute -inset-[3px] border border-[rgba(59,130,246,0.8)] rounded-[11px]"></div>

          <!-- Scanline Effect -->
          <div class="absolute inset-0 rounded-[16px] overflow-hidden">
            <div
              class="absolute -inset-[200%] w-[500%] h-[500%] bg-[linear-gradient(45deg,transparent_42%,rgba(59,130,246,0.05)_45%,rgba(59,130,246,0.05)_50%,transparent_53%)] animate-shimmer"
            ></div>
          </div>
        </div>
      {/if}

      {#if hovered}
        <div class="absolute inset-0 pointer-events-none z-30 rounded-[8px] border-2 border-yellow-500" transition:fade={{ duration: 150 }}></div>
      {/if}

      <div
        class="relative z-10 bg-surface border transition-all duration-200 rounded-[8px] flex flex-col overflow-hidden group {selected
          ? 'border-primary'
          : 'border-primary/20 hover:border-primary/50 hover:shadow-soft'} {status === 'pending' ? 'opacity-60 grayscale' : ''}"
      >
        <!-- Header Section -->
        <div class="px-3 py-1.5 flex items-center gap-2 bg-surface-highlight/30">
          <Icon class="size-3.5 text-text-secondary/80 shrink-0" />

          <div class="flex-1 min-w-0 flex items-center justify-between gap-2">
            <span class="text-[11px] font-medium text-text-main truncate leading-tight">{name}</span>

            <!-- Status Indicator -->
            {#if status === "running"}
              <RefreshCw class="size-3 text-primary animate-spin shrink-0" />
            {:else if status === "completed"}
              <Check class="size-3 text-success shrink-0" />
            {:else if status === "failed"}
              <AlertCircle class="size-3 text-error shrink-0" />
            {:else if status === "pending"}
              <div class="size-1.5 rounded-full bg-gray-300 shrink-0"></div>
            {/if}
          </div>
        </div>

        <!-- Content Section (Error only for now) -->
        {#if status === "failed" && error}
          <div class="px-3 py-1.5 bg-red-50/30 border-t border-red-100/50">
            <p class="text-[10px] text-text-main line-clamp-2 leading-relaxed">{error.message}</p>
          </div>
        {/if}
      </div>

      <!-- Runtime / Execution Time -->
      {#if startTime !== undefined}
        {#if status === "running"}
          <RunningTimer {startTime} />
        {:else if endTime !== undefined}
          <span class="absolute left-[14px] top-[calc(100%+4px)] text-[9px] text-text-secondary font-mono whitespace-nowrap">
            {formatDuration(endTime - startTime)}
          </span>
        {/if}
      {/if}
    </div>
  {/snippet}
</HeadlessToolNode>

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
