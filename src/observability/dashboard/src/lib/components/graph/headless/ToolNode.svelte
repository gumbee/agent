<script lang="ts" module>
  import type { NodeStatus, ExecutionToolNode, ToolYield } from "@gumbee/agent/graph"
  import type { Snippet } from "svelte"

  export interface ToolNodeSlotProps {
    name: string
    status: NodeStatus
    input: unknown
    output: unknown
    error: { message: string; stack?: string } | undefined
    events: ToolYield[]
    selected: boolean
  }

  export interface ToolNodeProps {
    data: {
      label: string
      status: NodeStatus
      input: unknown
      output?: unknown
      error?: { message: string; stack?: string }
      nodeData: ExecutionToolNode
    }
    selected?: boolean
    children: Snippet<[ToolNodeSlotProps]>
  }
</script>

<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte"

  let { data, selected = false, children }: ToolNodeProps = $props()
</script>

{@render children({
  name: data.label,
  status: data.status,
  input: data.input,
  output: data.output,
  error: data.error,
  events: data.nodeData.events,
  selected,
})}

<Handle type="target" position={Position.Left} class="bg-gray-300! opacity-0" />
<Handle type="source" position={Position.Right} class="bg-gray-300! opacity-0" />
