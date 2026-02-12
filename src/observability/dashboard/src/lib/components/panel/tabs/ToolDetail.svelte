<script lang="ts">
  import { safeStringify } from "$lib/utils/json"
  import { Loader2, CheckCircle, XCircle, ArrowDown, ArrowUp, Activity } from "@lucide/svelte"
  import CodeBlock from "$lib/components/ui/CodeBlock.svelte"
  import type { ExecutionToolNode } from "@gumbee/agent/graph"
  import type { Component } from "svelte"

  let { node }: { node: ExecutionToolNode } = $props()
</script>

{#snippet statusBadge(status: ExecutionToolNode["status"])}
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

<div class="flex flex-col py-4 px-5 space-y-5">
  <div class="flex items-start gap-2">
    <div class="flex flex-col gap-0.5 min-w-0">
      <h2 class="text-sm font-semibold text-text-main capitalize tracking-tight leading-none truncate">{node.name || node.type}</h2>
      <span class="text-[10px] text-text-secondary font-mono">{node.id.slice(0, 8)}</span>
    </div>
  </div>

  {#if node.error}
    <div class="text-xs text-error bg-error/5 border-l-2 border-error px-3 py-2">
      <div class="font-medium mb-0.5">Error</div>
      <div class="font-mono opacity-90 leading-relaxed">{node.error.message}</div>
    </div>
  {/if}

  <div class="flex flex-col gap-2.5">
    <div class="flex flex-col gap-2.5 text-[10px] text-text-secondary">
      <div class="flex items-center justify-between gap-3 min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <Activity class="size-3.5 shrink-0 opacity-70" />
          <span class="opacity-70">Status</span>
        </div>
        {@render statusBadge(node.status)}
      </div>
    </div>

    {#if node.input !== undefined || node.output !== undefined}
      <hr class="border-border-subtle -mx-5 my-2" />
    {/if}

    {#if node.input !== undefined || node.output !== undefined}
      <div class="flex flex-col gap-5">
        {#if node.input !== undefined}
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary uppercase tracking-wider opacity-80">
              <ArrowDown class="size-3" /> Input
            </div>
            <div class="-mx-1">
              <CodeBlock code={safeStringify(node.input, 2)} language="json" />
            </div>
          </div>
        {/if}

        {#if node.output !== undefined}
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5 text-[10px] font-medium text-text-secondary uppercase tracking-wider opacity-80">
              <ArrowUp class="size-3" /> Result
            </div>
            <div class="-mx-1">
              <CodeBlock code={safeStringify(node.output, 2)} language="json" />
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
