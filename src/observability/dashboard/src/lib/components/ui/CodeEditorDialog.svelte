<script lang="ts">
  import { Check, Copy, X } from "@lucide/svelte"
  import Dialog from "$lib/components/ui/dialog/Dialog.svelte"
  import Tooltip from "$lib/components/ui/tooltip/Tooltip.svelte"
  import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
  import type * as Monaco from "monaco-editor"

  type Props = {
    open?: boolean
    code: string
    language?: string
    onClose?: () => void
  }

  let { open = $bindable(false), code, language = "json", onClose }: Props = $props()

  let container = $state<HTMLDivElement | null>(null)
  let editor = $state<Monaco.editor.IStandaloneCodeEditor | null>(null)
  let copied = $state(false)
  let closeNotified = $state(false)
  let focusEditorOnOpen = $state(false)
  let renderEscapedNewlines = $state(false)
  const hasEscapedNewlines = $derived(code.includes("\\n"))

  const displayCode = $derived(renderEscapedNewlines ? code.replace(/\\n/g, "\n") : code)

  function normalizeLanguage(value: string): string {
    switch (value) {
      case "js":
      case "javascript":
        return "javascript"
      case "ts":
      case "typescript":
        return "typescript"
      case "md":
      case "markdown":
        return "markdown"
      case "bash":
      case "sh":
      case "shell":
        return "shell"
      default:
        return value
    }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code)
    copied = true
    setTimeout(() => {
      copied = false
    }, 1500)
  }

  $effect(() => {
    if (!open || !container || typeof window === "undefined") return

    let cancelled = false
    const mount = async () => {
      const m = await import("monaco-editor")
      if (cancelled || !container) return

      const globalContext = globalThis as typeof globalThis & {
        MonacoEnvironment?: { getWorker: () => Worker }
      }

      globalContext.MonacoEnvironment = {
        getWorker: () => new EditorWorker(),
      }

      m.editor.defineTheme("gumbee-light", {
        base: "vs",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6e7781", fontStyle: "italic" },
          { token: "keyword", foreground: "cf222e" },
          { token: "number", foreground: "0550ae" },
          { token: "string", foreground: "0a3069" },
          { token: "type", foreground: "8250df" },
          { token: "function", foreground: "8250df" },
        ],
        colors: {
          "editor.background": "#fafafa",
          "editor.foreground": "#1a1a1a",
          "editorLineNumber.foreground": "#888888",
          "editorLineNumber.activeForeground": "#1a1a1a",
          "editorGutter.background": "#fafafa",
          "editor.lineHighlightBackground": "#f3f4f6",
          "editor.selectionBackground": "#dbeafe",
          "editor.inactiveSelectionBackground": "#e5e7eb",
        },
      })

      editor = m.editor.create(container, {
        value: displayCode,
        language: normalizeLanguage(language),
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingIndent: "indent",
        automaticLayout: true,
        renderLineHighlight: "gutter",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        padding: { bottom: 60 },
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        theme: "gumbee-light",
        scrollbar: {
          vertical: "hidden",
          horizontal: "hidden",
          handleMouseWheel: true,
          alwaysConsumeMouseWheel: false,
        },
      })

      if (focusEditorOnOpen) {
        editor.focus()
        focusEditorOnOpen = false
      }
    }

    mount()

    return () => {
      cancelled = true
      editor?.dispose()
      editor = null
    }
  })

  $effect(() => {
    if (!open || !editor) return

    const model = editor.getModel()
    if (!model) return
    if (model.getValue() !== displayCode) {
      model.setValue(displayCode)
    }

    void import("monaco-editor").then((m) => {
      const modelLanguage = renderEscapedNewlines ? "plaintext" : normalizeLanguage(language)
      m.editor.setModelLanguage(model, modelLanguage)
    })
  })

  $effect(() => {
    if (!open) {
      if (!closeNotified) {
        onClose?.()
        closeNotified = true
      }
      return
    }
    closeNotified = false
  })
</script>

<Dialog
  bind:open
  contentClass="!inset-0 !left-0 !top-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 rounded-none border-0 p-0 flex flex-col overflow-hidden"
  contentProps={{
    interactOutsideBehavior: "close",
    escapeKeydownBehavior: "close",
    onOpenAutoFocus: (event) => {
      event.preventDefault()
      focusEditorOnOpen = true
    },
  }}
>
  <div class="border-b border-border-subtle bg-surface-highlight px-4 py-2">
    <div class="mx-auto flex w-full max-w-[700px] items-center justify-between">
      <span class="text-[10px] font-medium text-text-secondary uppercase tracking-wider">Editor</span>

      <div class="flex items-center gap-1">
        {#if hasEscapedNewlines}
          <button
            type="button"
            class={`inline-flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              renderEscapedNewlines ? "bg-surface text-text-main" : "text-text-secondary hover:bg-surface hover:text-text-main"
            }`}
            aria-pressed={renderEscapedNewlines}
            aria-label="Toggle newline rendering"
            onclick={() => (renderEscapedNewlines = !renderEscapedNewlines)}
          >
            Render \n
          </button>
        {/if}
        <Tooltip
          text={copied ? "Copied" : "Copy"}
          triggerProps={{
            onclick: copyCode,
            "aria-label": "Copy code",
            class:
              "inline-flex items-center justify-center rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface hover:text-text-main",
          }}
        >
          {#if copied}
            <Check class="size-3.5" />
          {:else}
            <Copy class="size-3.5" />
          {/if}
        </Tooltip>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface hover:text-text-main"
          aria-label="Close editor"
          onclick={() => (open = false)}
        >
          <X class="size-3.5" />
        </button>
      </div>
    </div>
  </div>

  <div class="min-h-0 flex flex-1 flex-col overflow-hidden bg-surface-highlight px-4 pt-8 pb-0">
    <div class="mx-auto flex min-h-0 w-full max-w-[700px] flex-1 flex-col gap-3">
      <h2 class="w-full text-left text-2xl font-semibold tracking-tight text-text-main mb-[24px]">
        Fullscreen {language.toUpperCase()} Viewer
      </h2>
      <div bind:this={container} class="min-h-0 w-full flex-1 rounded-lg bg-surface"></div>
    </div>
  </div>
</Dialog>

<style>
  :global(.monaco-editor .scrollbar) {
    display: none !important;
  }
</style>
