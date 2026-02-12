export class SelectionStore {
  selectedNodeId: string | null = $state(null)
  hoveredNodeId: string | null = $state(null)
  panelOpen = $state(false)
  activeTab = $state("execution")
  pendingFitNodeId: string | null = $state(null)

  selectNode(id: string, options?: { navigate?: boolean }) {
    this.hoveredNodeId = null
    this.selectedNodeId = id
    this.panelOpen = true
    if (options?.navigate) {
      this.pendingFitNodeId = id
    }
  }

  hoverNode(id: string | null) {
    this.hoveredNodeId = id
  }

  acknowledgeFit() {
    this.pendingFitNodeId = null
  }

  clearSelection() {
    this.selectedNodeId = null
    this.panelOpen = false
    this.activeTab = "execution"
  }

  closePanel() {
    this.panelOpen = false
  }

  setTab(tab: string) {
    this.activeTab = tab
  }
}

export const selection = new SelectionStore()
