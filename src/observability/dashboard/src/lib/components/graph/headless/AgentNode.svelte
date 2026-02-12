<script lang="ts" module>
  import type { NodeStatus, ExecutionAgentNode, ThinkingConfig } from "@gumbee/agent/graph"
  import type { ModelMessage } from "ai"
  import type { Snippet } from "svelte"

  export interface AgentNodeSlotProps {
    name: string
    status: NodeStatus
    input: unknown
    error: { message: string; stack?: string } | undefined
    messages: ModelMessage[]
    events: any[]
    selected: boolean
    modelId?: string
    provider?: string
    usage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
      cacheReadTokens?: number
      cacheWriteTokens?: number
    }
    thinking?: ThinkingConfig
  }

  export interface AgentNodeProps {
    data: {
      label: string
      status: NodeStatus
      input: unknown
      error?: { message: string; stack?: string }
      nodeData: ExecutionAgentNode
    }
    selected?: boolean
    children: Snippet<[AgentNodeSlotProps]>
  }
</script>

<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte"

  let { data, selected = false, children }: AgentNodeProps = $props()
</script>

{@render children({
  name: data.label,
  status: data.status,
  input: data.input,
  error: data.error,
  messages: data.nodeData.messages,
  events: data.nodeData.events,
  selected,
  modelId: data.nodeData.modelId,
  provider: data.nodeData.provider,
  usage: data.nodeData.usage,
  thinking: data.nodeData.thinking,
})}

<Handle type="target" position={Position.Left} class="bg-gray-300! opacity-0" />
<Handle type="source" position={Position.Right} class="bg-gray-300! opacity-0" />
