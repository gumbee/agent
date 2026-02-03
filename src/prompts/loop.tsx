/** @jsxImportSource @gumbee/prompt */

import { Native, System } from "@gumbee/prompt"
import type { ModelMessage } from "ai"
import type { Runner } from "../runtime/types"

type AgentLoopPromptProps = {
  system: string
  tools: Runner[]
  messages: ModelMessage[]
}

export function AgentLoopPrompt({ system, tools, messages }: AgentLoopPromptProps) {
  return (
    <>
      <System>{system}</System>
      {tools.map((t) => (t.instructions ? <System>{t.instructions}</System> : null))}
      {messages.map((m) => (
        <Native content={m} />
      ))}
    </>
  )
}
