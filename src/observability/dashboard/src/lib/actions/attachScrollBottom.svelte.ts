export const attachScrollBottom = (element: HTMLElement) => {
  let wasAtBottom = true
  let scrollHeight = element.scrollHeight

  // Disable browser scroll anchoring to prevent conflicts with manual scroll management
  element.style.overflowAnchor = "none"

  const handleScroll = () => {
    const diff = element.scrollHeight - element.clientHeight - element.scrollTop
    // If the user is within 10px of the bottom, we consider them at the bottom
    // or if the content is smaller than the container
    wasAtBottom = element.scrollHeight <= element.clientHeight || diff <= 10
  }

  // Set up MutationObserver to monitor content changes
  const mutationObserver = new MutationObserver(() => {
    // Only scroll if content actually grew (new content added)
    if (element.scrollHeight > scrollHeight) {
      scrollHeight = element.scrollHeight
      if (wasAtBottom) {
        element.scrollTop = element.scrollHeight
      }
    }
  })

  handleScroll()

  // Observe the chat container element for content changes
  // Note: removed 'attributes: true' to avoid triggering on animation/style changes
  mutationObserver.observe(element, { childList: true, subtree: true, characterData: true })

  element.addEventListener("scroll", handleScroll, { passive: true })

  return {
    destroy: () => {
      element.removeEventListener("scroll", handleScroll)
      mutationObserver.disconnect()
    },
  }
}
