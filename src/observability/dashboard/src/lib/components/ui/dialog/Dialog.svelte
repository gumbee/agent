<script lang="ts">
  import { Dialog as DialogPrimitive, type WithoutChildrenOrChild } from "bits-ui"
  import type { Snippet } from "svelte"

  type Props = {
    open?: boolean
    children?: Snippet
    contentClass?: string
    overlayClass?: string
    contentProps?: WithoutChildrenOrChild<DialogPrimitive.ContentProps>
  }

  let { open = $bindable(false), children, contentClass = "", overlayClass = "", contentProps = {} }: Props = $props()
</script>

<DialogPrimitive.Root bind:open>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class={`fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ${overlayClass}`}
    />
    <DialogPrimitive.Content
      {...contentProps}
      class={`fixed left-1/2 top-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface shadow-float outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ${contentClass}`}
    >
      {@render children?.()}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
