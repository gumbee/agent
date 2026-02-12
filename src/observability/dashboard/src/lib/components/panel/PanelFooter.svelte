<script lang="ts">
  let { stats }: { stats: { label: string; value: string }[] } = $props()
</script>

<div class="p-4 border-t border-border-subtle bg-white sticky bottom-0 z-20">
  <div class="flex justify-between items-center gap-2">
    {#each stats as stat, i}
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] text-text-secondary font-mono uppercase tracking-wider">{stat.label}</span>
        <span class="text-xs font-semibold text-text-main">{stat.value}</span>
      </div>
      {#if i < stats.length - 1}
        <div class="w-px h-6 bg-border-subtle"></div>
      {/if}
    {/each}
  </div>
</div>
