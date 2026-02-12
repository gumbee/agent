<script lang="ts">
  import { ChevronDown } from "@lucide/svelte"

  let {
    name,
    description,
    duration,
    dotColor = "bg-gray-300",
    isError = false,
    details,
  }: {
    name: string
    description: string
    duration?: string
    dotColor?: string
    isError?: boolean
    details?: Record<string, unknown>
  } = $props()
</script>

<div class="relative pl-4 py-1.5">
  <div class="absolute left-1 top-0 bottom-0 w-px bg-border-subtle"></div>
  <div class="absolute left-[1px] top-3 size-1.5 rounded-full ring-2 ring-white {dotColor}"></div>
  <div class="flex items-start justify-between gap-4">
    <div>
      <span class="text-[11px] font-medium {isError ? 'text-error' : 'text-text-main'} block">{name}</span>
      <span class="text-[10px] text-text-secondary block">{description}</span>
    </div>
    {#if duration}
      <span
        class="text-[9px] font-mono px-1.5 py-0.5 rounded border {isError
          ? 'text-error bg-red-50/50 border-red-100'
          : 'text-text-secondary bg-gray-50 border-border-subtle'}"
      >
        {duration}
      </span>
    {/if}
  </div>

  {#if details}
    <details class="group/json mt-1.5">
      <summary class="text-[9px] text-text-secondary hover:text-text-main cursor-pointer flex items-center gap-1 select-none w-fit transition-colors">
        <span>Details</span>
        <ChevronDown class="size-2.5 group-open/json:rotate-180 transition-transform" />
      </summary>
      <div class="mt-1.5 {isError ? 'bg-red-50/30 border-red-100' : 'bg-gray-50/50 border-border-subtle'} rounded p-2 border overflow-x-auto">
        <pre class="text-[9px] font-mono leading-relaxed text-text-secondary">{JSON.stringify(details, null, 2)}</pre>
      </div>
    </details>
  {/if}
</div>
