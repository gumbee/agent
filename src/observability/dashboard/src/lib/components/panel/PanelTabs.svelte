<script lang="ts">
  let {
    tabs,
    activeTab,
    onTabChange,
  }: {
    tabs: { id: string; label: string }[]
    activeTab: string
    onTabChange: (id: string) => void
  } = $props()
</script>

<div class="flex border-b border-border-subtle bg-white">
  {#each tabs as tab}
    <button
      class="flex-1 py-2.5 text-[11px] transition-colors {activeTab === tab.id
        ? 'font-semibold text-text-main border-b border-black -mb-px'
        : 'font-medium text-text-secondary hover:text-text-main'}"
      onclick={() => onTabChange(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>
