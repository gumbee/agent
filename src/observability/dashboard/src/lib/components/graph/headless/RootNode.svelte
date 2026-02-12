<script lang="ts" module>
  import type { NodeStatus, ExecutionRootNode } from "@gumbee/agent/graph"
  import type { Snippet } from "svelte"

  export interface RootNodeSlotProps {
    name: string
    status: NodeStatus
    error: { message: string; stack?: string } | undefined
    childCount: number
    selected: boolean
  }

  export interface RootNodeProps {
    data: {
      label: string
      status: NodeStatus
      error?: { message: string; stack?: string }
      nodeData: ExecutionRootNode
    }
    selected?: boolean
    children: Snippet<[RootNodeSlotProps]>
  }
</script>

<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte"

  let { data, selected = false, children }: RootNodeProps = $props()
</script>

{@render children({
  name: data.label,
  status: data.status,
  error: data.error,
  childCount: data.nodeData.children?.length ?? 0,
  selected,
})}

<Handle type="source" position={Position.Right} class="bg-gray-300! opacity-0" />
