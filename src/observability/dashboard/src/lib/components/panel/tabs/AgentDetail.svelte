<script lang="ts">
  import { safeStringify } from "$lib/utils/json"
  import { formatTokens } from "$lib/utils/format"
  import { Loader2, CheckCircle, XCircle, Bot, Brain, Coins, ArrowDown, ArrowUp, Activity, DatabaseZap, Database } from "@lucide/svelte"
  import CodeBlock from "$lib/components/ui/CodeBlock.svelte"
  import AnimatedTokenCount from "$lib/components/ui/AnimatedTokenCount.svelte"
  import ModelLogoStack from "$lib/components/logos/ModelLogoStack.svelte"
  import type { ExecutionAgentNode } from "@gumbee/agent/graph"
  import type { Component } from "svelte"

  let { node }: { node: ExecutionAgentNode } = $props()

  const models = $derived.by(() => {
    const source =
      node.models && node.models.length > 0
        ? node.models.map((model) => ({
            modelId: String(model.modelId ?? "unknown"),
            provider: String(model.provider ?? "unknown"),
          }))
        : node.modelId || node.provider
          ? [
              {
                modelId: String(node.modelId ?? "unknown"),
                provider: String(node.provider ?? "unknown"),
              },
            ]
          : []

    const seen = new Set<string>()

    return source.filter((model) => {
      const key = model.modelId
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })

  const mainModel = $derived.by(() => {
    if (node.modelId) return String(node.modelId)
    return models[0]?.modelId ?? "unknown"
  })

  const fallbackModels = $derived.by(() => models.filter((model) => model.modelId !== mainModel))
</script>

{#snippet statusBadge(status: ExecutionAgentNode["status"])}
  {#if status === "running"}
    <span
      class="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-blue-500"
    >
      <Loader2 class="size-2.5 animate-spin text-blue-500" />
      Running
    </span>
  {:else if status === "completed"}
    <span
      class="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-success"
    >
      <CheckCircle class="size-2.5 text-success" />
      Completed
    </span>
  {:else if status === "failed"}
    <span
      class="inline-flex items-center gap-1 rounded-full border border-error/25 bg-error/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-error"
    >
      <XCircle class="size-2.5 text-error" />
      Failed
    </span>
  {:else}
    <span
      class="inline-flex items-center rounded-full border border-border-subtle/60 bg-surface-tertiary/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-secondary"
    >
      {status}
    </span>
  {/if}
{/snippet}

{#snippet detailRow(icon: Component, label: string, value: string | number, valueClass: string = "text-text-main font-mono normal-case")}
  {@const Icon = icon}
  <div class="flex items-center justify-between gap-3 min-w-0">
    <div class="flex items-center gap-2 min-w-0">
      <Icon class="size-3.5 shrink-0 opacity-70" />
      <span class="opacity-70">{label}</span>
    </div>
    <span class={valueClass}>{value}</span>
  </div>
{/snippet}

{#snippet tokenDetailRow(icon: Component, label: string, value: number, valueClass: string = "text-text-main font-mono normal-case")}
  {@const Icon = icon}
  <div class="flex items-center justify-between gap-3 min-w-0">
    <div class="flex items-center gap-2 min-w-0">
      <Icon class="size-3.5 shrink-0 opacity-70" />
      <span class="opacity-70">{label}</span>
    </div>
    <AnimatedTokenCount {value} class={valueClass} />
  </div>
{/snippet}

<div class="flex flex-col py-4 px-5 space-y-5">
  <div class="flex items-start justify-between gap-2">
    <div class="flex flex-col gap-0.5">
      <h2 class="text-sm font-semibold text-text-main capitalize tracking-tight leading-none">{node.type}</h2>
      <span class="text-[10px] text-text-secondary font-mono">{node.id.slice(0, 8)}</span>
    </div>
  </div>

  {#if node.error}
    <div class="text-xs text-error bg-error/5 border-l-2 border-error px-3 py-2">
      <div class="font-medium mb-0.5">Error</div>
      <div class="font-mono opacity-90 leading-relaxed">{node.error.message}</div>
    </div>
  {/if}

  <div class="flex flex-col gap-2.5 text-[10px] text-text-secondary">
    <div class="flex items-center justify-between gap-3 min-w-0">
      <div class="flex items-center gap-2 min-w-0">
        <Activity class="size-3.5 shrink-0 opacity-70" />
        <span class="opacity-70">Status</span>
      </div>
      {@render statusBadge(node.status)}
    </div>

    {@render detailRow(Bot, "Model", mainModel, "text-text-main font-mono truncate min-w-0 text-right")}

    {#if fallbackModels.length > 0}
      <div class="flex items-center justify-between gap-3 min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <Bot class="size-3.5 shrink-0 opacity-70" />
          <span class="opacity-70">Fallbacks</span>
        </div>
        <ModelLogoStack models={fallbackModels} />
      </div>
    {/if}

    {#if node.thinking?.enabled}
      {@render detailRow(Brain, "Thinking", node.thinking.level || "default", "text-text-main font-mono truncate min-w-0 text-right")}

      {#if node.thinking.budgetTokens}
        {@render detailRow(Coins, "Budget", formatTokens(node.thinking.budgetTokens), "text-text-main font-mono truncate min-w-0 text-right")}
      {/if}
    {/if}

    {@render detailRow(Activity, "Steps Executed", (node.children?.length ?? 0) + 1, "text-text-main font-mono text-right")}

    {#if node.usage}
      {#key node.id}
        <hr class="border-border-subtle -mx-5 my-2" />

        {@render tokenDetailRow(ArrowDown, "Input", node.usage.inputTokens)}

        {@render tokenDetailRow(ArrowUp, "Output", node.usage.outputTokens)}

        {#if (node.usage.cacheReadTokens ?? 0) > 0 || (node.usage.cacheWriteTokens ?? 0) > 0}
          {@render tokenDetailRow(Database, "Cache Read", node.usage.cacheReadTokens ?? 0)}

          {@render tokenDetailRow(DatabaseZap, "Cache Write", node.usage.cacheWriteTokens ?? 0)}
        {/if}

        {@render tokenDetailRow(Coins, "Total", node.usage.totalTokens, "text-text-main font-mono font-semibold normal-case")}
      {/key}
    {/if}
  </div>

  {#if node.input}
    <hr class="border-border-subtle -mx-5 my-2" />
  {/if}

  {#if node.input !== undefined}
    <div class="flex flex-col gap-1.5 mt-[14px]">
      <div class="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary uppercase tracking-wider opacity-80">
        <ArrowDown class="size-3" /> Input
      </div>
      <div class="-mx-1">
        <CodeBlock code={safeStringify(node.input, 2)} language="json" />
      </div>
    </div>
  {/if}
</div>
