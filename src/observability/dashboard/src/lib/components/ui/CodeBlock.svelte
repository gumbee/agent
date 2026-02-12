<script lang="ts">
  import { Check, Copy, Maximize2 } from "@lucide/svelte"
  import Prism from "prismjs"
  import "prismjs/components/prism-json"
  import "prismjs/components/prism-javascript"
  import "prismjs/components/prism-typescript"
  import "prismjs/components/prism-bash"
  import "prismjs/components/prism-markdown"
  import Tooltip from "$lib/components/ui/tooltip/Tooltip.svelte"
  import CodeEditorDialog from "$lib/components/ui/CodeEditorDialog.svelte"

  let { code, language = "json" }: { code: string; language?: string } = $props()

  let highlightedCode = $state("")
  let copied = $state(false)
  let dialogOpen = $state(false)

  async function copyCode() {
    await navigator.clipboard.writeText(code)
    copied = true
    setTimeout(() => {
      copied = false
    }, 1500)
  }

  function highlight() {
    const grammar = Prism.languages[language] || Prism.languages.plaintext
    highlightedCode = Prism.highlight(code, grammar, language)
  }

  $effect(() => {
    // Re-highlight when code or language changes
    if (code) {
      highlight()
    }
  })
</script>

<div class="code-block relative group rounded-lg border border-border-subtle overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 bg-surface-highlight border-b border-border-subtle">
    <span class="text-[9px] font-medium text-text-secondary uppercase tracking-wider">{language}</span>
    <div class="flex items-center gap-1">
      <Tooltip
        text={copied ? "Copied" : "Copy"}
        triggerProps={{
          onclick: copyCode,
          "aria-label": "Copy code",
          class:
            "inline-flex items-center justify-center rounded-sm p-1 text-text-secondary transition-colors hover:bg-surface hover:text-text-main opacity-0 group-hover:opacity-100 focus-visible:opacity-100 duration-150",
        }}
      >
        {#if copied}
          <Check class="size-3" />
        {:else}
          <Copy class="size-3" />
        {/if}
      </Tooltip>
      <Tooltip
        text="Fullscreen"
        triggerProps={{
          onclick: () => (dialogOpen = true),
          "aria-label": "Open fullscreen editor",
          class:
            "inline-flex items-center justify-center rounded-sm p-1 text-text-secondary transition-colors hover:bg-surface hover:text-text-main opacity-0 group-hover:opacity-100 focus-visible:opacity-100 duration-150",
        }}
      >
        <Maximize2 class="size-3" />
      </Tooltip>
    </div>
  </div>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  <pre class="bg-surface-highlight! p-3! m-0! overflow-x-auto text-[10px] font-mono leading-relaxed border-none! rounded-none!"><code
      class="language-{language}">{@html highlightedCode}</code
    ></pre>
</div>

<CodeEditorDialog bind:open={dialogOpen} {code} {language} />

<style>
  /* Prism.js syntax highlighting aligned with Monaco gumbee-light theme */
  :global(.token.comment),
  :global(.token.prolog),
  :global(.token.doctype),
  :global(.token.cdata) {
    color: #6e7781;
    font-style: italic;
  }

  :global(.token.punctuation) {
    color: #1a1a1a;
  }

  :global(.token.property),
  :global(.token.tag),
  :global(.token.boolean),
  :global(.token.number),
  :global(.token.constant),
  :global(.token.symbol),
  :global(.token.deleted) {
    color: #0550ae;
  }

  :global(.token.selector),
  :global(.token.attr-name),
  :global(.token.string),
  :global(.token.char),
  :global(.token.builtin),
  :global(.token.inserted) {
    color: #0a3069;
  }

  :global(.token.operator),
  :global(.token.entity),
  :global(.token.url),
  :global(.language-css .token.string),
  :global(.style .token.string) {
    color: #cf222e;
  }

  :global(.token.atrule),
  :global(.token.attr-value),
  :global(.token.keyword) {
    color: #cf222e;
  }

  :global(.token.function),
  :global(.token.class-name),
  :global(.token.function-variable),
  :global(.token.maybe-class-name) {
    color: #8250df;
  }

  :global(.token.regex),
  :global(.token.important),
  :global(.token.variable) {
    color: #cf222e;
  }

  :global(.token.important),
  :global(.token.bold) {
    font-weight: bold;
  }

  :global(.token.italic) {
    font-style: italic;
  }

  :global(.token.namespace) {
    opacity: 0.7;
  }
</style>
