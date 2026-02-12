<script lang="ts">
  import { X } from "@lucide/svelte"

  let { title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void } = $props()
</script>

<div class="px-5 py-4 border-b border-border-subtle flex items-start justify-between bg-white z-10">
  <div>
    <div class="flex items-center gap-2 mb-1">
      <span class="material-symbols-outlined text-sm text-text-main">analytics</span>
      <h2 class="text-sm font-semibold text-text-main tracking-tight">{title}</h2>
    </div>
    <div class="flex items-center gap-2 text-[10px] text-text-secondary font-mono">
      {@html subtitle}
    </div>
  </div>
  <button
    class="size-6 flex items-center justify-center hover:bg-surface-highlight rounded-full text-text-secondary hover:text-text-main transition-colors"
    onclick={onClose}
  >
    <X class="size-4" />
  </button>
</div>
