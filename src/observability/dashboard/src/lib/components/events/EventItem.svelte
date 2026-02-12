<script lang="ts">
  import HeadlessEventItem from "./headless/EventItem.svelte"
  import CodeEditorDialog from "$lib/components/ui/CodeEditorDialog.svelte"
  import { RefreshCcw } from "@lucide/svelte"

  let {
    event,
    dotColor,
    isError,
  }: {
    event: any
    dotColor?: string
    isError?: boolean
  } = $props()

  let dialogOpen = $state(false)

  function openCodeEditor(e: MouseEvent) {
    e.stopPropagation()
    dialogOpen = true
  }
</script>

<HeadlessEventItem {event}>
  {#snippet children({ type, formattedTime, payload, copyToClipboard: _ })}
    {@const error = isError ?? type.includes("error")}
    {@const dot = dotColor ?? (error ? "bg-error" : "bg-blue-400")}
    {@const payloadCode = JSON.stringify(payload, null, 2) ?? "null"}
    {#snippet detailRow(label: string, value: string, valueClass: string = "text-text-main font-mono truncate min-w-0")}
      <div class="flex items-start gap-3 min-w-0 text-[10px] text-text-secondary">
        <span class="opacity-70 w-[50px]">{label}</span>
        <span class={`${valueClass} flex-1`}>{value}</span>
      </div>
    {/snippet}
    {#if type === "agent-step-retry"}
      {@const retryPayload = payload as any}
      {@const toModel = String(retryPayload.toModelId ?? "unknown")}
      {@const toProvider = retryPayload.toProvider ? String(retryPayload.toProvider) : null}
      {@const retryError =
        retryPayload.error === undefined || retryPayload.error === null
          ? null
          : typeof retryPayload.error === "string"
            ? retryPayload.error
            : JSON.stringify(retryPayload.error)}
      <div class="relative pl-4 py-1.5">
        <div class="absolute left-1 top-0 bottom-0 w-px bg-border-subtle"></div>
        <div class="absolute left-px top-2.5 size-1.5 rounded-full ring-2 ring-white bg-amber-500"></div>
        <div class="flex items-start justify-between gap-4">
          <div class="inline-flex items-center gap-1 text-[11px] font-medium text-text-main min-w-0 truncate">
            <RefreshCcw class="size-2.5 text-amber-600 shrink-0" />
            <span>retry with fallback model</span>
          </div>
        </div>

        <div class="mt-1.5 flex flex-col gap-1 min-w-0">
          {@render detailRow("Model", toModel)}
          {#if toProvider}
            {@render detailRow("Provider", toProvider)}
          {/if}
          {#if retryError}
            {@render detailRow("Reason", retryError, "text-amber-700 font-mono line-clamp-2")}
          {/if}
        </div>

        <div class="mt-1.5">
          <button
            class="text-[9px] text-text-secondary hover:text-text-main cursor-pointer flex items-center gap-1 select-none w-fit transition-colors bg-transparent border-0 p-0"
            onclick={openCodeEditor}
          >
            <span>Open</span>
          </button>
        </div>
      </div>
    {:else}
      <div class="relative pl-4 py-1.5">
        <div class="absolute left-1 top-0 bottom-0 w-px bg-border-subtle"></div>
        <div class="absolute left-px top-3 size-1.5 rounded-full ring-2 ring-white {dot}"></div>
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="text-[11px] font-medium {error ? 'text-error' : 'text-text-main'} block"
              >{type}
              {#if type === "agent-stream"}
                {@const part = payload.part as any}
                <span class="text-[9px] text-text-secondary font-mono">({part.type})</span>
              {/if}
            </span>
            <span class="text-[10px] text-text-secondary block">{formattedTime}</span>
          </div>
        </div>

        <div class="mt-1.5">
          <button
            class="text-[9px] text-text-secondary hover:text-text-main cursor-pointer flex items-center gap-1 select-none w-fit transition-colors bg-transparent border-0 p-0"
            onclick={openCodeEditor}
          >
            <span>Open</span>
          </button>
        </div>
      </div>
    {/if}
    <CodeEditorDialog bind:open={dialogOpen} code={payloadCode} language="json" />
  {/snippet}
</HeadlessEventItem>
