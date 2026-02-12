<script lang="ts">
  import { Tooltip as TooltipPrimitive, type WithoutChildrenOrChild } from "bits-ui"
  import type { Snippet } from "svelte"

  type Props = {
    text: string
    open?: boolean
    delayDuration?: number
    disableHoverableContent?: boolean
    ignoreNonKeyboardFocus?: boolean
    disableCloseOnTriggerClick?: boolean
    children?: Snippet
    side?: "top" | "bottom" | "left" | "right"
    sideOffset?: number
    contentClass?: string
    triggerClass?: string
    triggerProps?: WithoutChildrenOrChild<TooltipPrimitive.TriggerProps>
    contentProps?: WithoutChildrenOrChild<TooltipPrimitive.ContentProps>
  }

  let {
    text,
    children,
    side = "top",
    sideOffset = 8,
    delayDuration = 200,
    contentClass = "",
    triggerClass = "",
    triggerProps = {},
    contentProps = {},
    open = undefined,
    disableHoverableContent = undefined,
    ignoreNonKeyboardFocus = undefined,
    disableCloseOnTriggerClick = undefined,
  }: Props = $props()
</script>

<TooltipPrimitive.Root {open} {delayDuration} {disableHoverableContent} {ignoreNonKeyboardFocus} {disableCloseOnTriggerClick}>
  <TooltipPrimitive.Trigger {...triggerProps} class={`${triggerClass} ${triggerProps.class ?? ""}`}>
    {@render children?.()}
  </TooltipPrimitive.Trigger>
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      {...contentProps}
      {side}
      {sideOffset}
      class={`z-50 rounded-[10px] border border-border-strong bg-text-main px-2 py-1 text-[9px] font-medium text-surface shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 ${contentClass}`}
    >
      {text}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
</TooltipPrimitive.Root>
