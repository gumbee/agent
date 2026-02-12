import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
  type PartialKeys,
  type VirtualizerOptions,
} from "@tanstack/virtual-core"

export function createVirtualizer<TScrollElement extends Element, TItemElement extends Element>(
  options: PartialKeys<VirtualizerOptions<TScrollElement, TItemElement>, "observeElementRect" | "observeElementOffset" | "scrollToFn">,
) {
  const {
    scrollToFn = elementScroll,
    observeElementRect: userObserveElementRect = observeElementRect,
    observeElementOffset: userObserveElementOffset = observeElementOffset,
    ...restOptions
  } = options

  const virtualizer = new Virtualizer<TScrollElement, TItemElement>({
    observeElementRect: userObserveElementRect,
    observeElementOffset: userObserveElementOffset,
    scrollToFn,
    ...restOptions,
  })

  let virtualItems = $state(virtualizer.getVirtualItems())
  let totalSize = $state(virtualizer.getTotalSize())

  $effect(() => {
    const {
      scrollToFn = elementScroll,
      observeElementRect: userObserveElementRect = observeElementRect,
      observeElementOffset: userObserveElementOffset = observeElementOffset,
      ...restOptions
    } = options

    virtualizer.setOptions({
      observeElementRect: userObserveElementRect,
      observeElementOffset: userObserveElementOffset,
      scrollToFn,
      ...restOptions,
      onChange: (instance, sync) => {
        virtualItems = instance.getVirtualItems()
        totalSize = instance.getTotalSize()
        options.onChange?.(instance, sync)
      },
    })
    virtualizer._willUpdate()

    // Always sync after options update. onChange only fires when visible
    // items change, but totalSize can change independently (e.g. count
    // grew while the same items are visible at scroll position 0).
    virtualItems = virtualizer.getVirtualItems()
    totalSize = virtualizer.getTotalSize()
  })

  return new Proxy(virtualizer, {
    get(target, prop, receiver) {
      if (prop === "getVirtualItems") {
        return () => virtualItems
      }
      if (prop === "getTotalSize") {
        return () => totalSize
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}
