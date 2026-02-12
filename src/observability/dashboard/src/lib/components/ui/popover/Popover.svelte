<script lang="ts">
  import { Popover as PopoverPrimitive, type WithoutChildrenOrChild } from "bits-ui"
  import type { Snippet } from "svelte"

  type Props = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children?: Snippet
    trigger?: Snippet
    side?: "top" | "bottom" | "left" | "right"
    sideOffset?: number
    contentClass?: string
    triggerClass?: string
    triggerProps?: WithoutChildrenOrChild<PopoverPrimitive.TriggerProps>
    contentProps?: WithoutChildrenOrChild<PopoverPrimitive.ContentProps>
  }

  let {
    open = $bindable(false),
    children,
    trigger,
    side = "bottom",
    sideOffset = 8,
    contentClass = "",
    triggerClass = "",
    triggerProps = {},
    contentProps = {},
    onOpenChange = undefined,
  }: Props = $props()
</script>

<PopoverPrimitive.Root bind:open {onOpenChange}>
  <PopoverPrimitive.Trigger {...triggerProps} class={`${triggerClass} ${triggerProps.class ?? ""}`}>
    {@render trigger?.()}
  </PopoverPrimitive.Trigger>
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      {...contentProps}
      {side}
      {sideOffset}
      class={`z-50 rounded-lg border border-border-strong bg-surface p-3 shadow-float outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${contentClass}`}
    >
      {@render children?.()}
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
