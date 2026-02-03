/** @jsxImportSource @gumbee/prompt */

import { type ModelMessage, streamText, type TextStreamPart, type ToolSet, type UserModelMessage } from "ai"
import { prompt } from "@gumbee/prompt/ai-sdk"
import { AgentLoopPrompt } from "../prompts/loop"
import { getCurrentNode, getPath } from "./graph/context"
import { createAsyncEventQueue, mergeStreamWithQueue } from "./merge-streams"
import { convertRunnersForAI } from "./tool"
import { createWidgetSchemaTool } from "./tool-definitions/widget-schema-tool"
import { transformWidgetStream } from "./widgets-transform"
import type { RuntimeYield, Runner, AgentLoopContext } from "./types"

/** Hard limit to prevent infinite loops if stop condition is misconfigured */
const MAX_STEPS_HARD_LIMIT = 100

/** Tool event types that can come from the event queue */
const TOOL_EVENT_TYPES = new Set(["tool-begin", "tool-end", "tool-error", "tool-progress"])

/** Check if an item is a tool event (from the event queue) vs a stream part */
function isToolEvent(item: unknown): item is RuntimeYield {
  return typeof item === "object" && item !== null && "type" in item && TOOL_EVENT_TYPES.has((item as { type: string }).type)
}

/**
 * Core execution generator that runs the agentic loop.
 * This is used both by run() for root agents and by execute() for sub-agents.
 *
 * Keeps JSX prompt enhancement and widget support while using the simplified
 * graph-based trace system.
 */
export async function* executeLoop<Context>(data: AgentLoopContext<Context>): AsyncGenerator<RuntimeYield, void, unknown> {
  const { prompt: userPrompt, system, tools, context, env, memory, widgets, widgetsPickerModel, model, providerOptions, stopCondition } = data
  // Get current node from context, or create new one for sub-agents
  const node = getCurrentNode()

  if (!node || node.type !== "agent") throw new Error("executeLoop must run within an agent node context")

  const path = getPath(node)

  node.setStatus("running")

  yield node.addEvent({ type: "agent-begin", path })

  try {
    // === INITIALIZATION ===

    // 1. Build system prompt (supports dynamic prompts via context)
    const baseSystemPrompt = typeof system === "function" ? system(context) : (system ?? "")

    // 2. Collect all tools, including widget schema tool if widgets are configured
    const allTools: Runner<Context>[] = [...(tools ?? [])]

    // Add widget schema tool if widgets registry is provided
    if (widgets && widgets.size > 0) {
      allTools.push(createWidgetSchemaTool(widgets, widgetsPickerModel ?? model) as Runner<Context>)
    }

    // 3. Build full system prompt including tool instructions
    const fullSystemPrompt = [baseSystemPrompt, ...allTools.map((tool) => tool.instructions).filter(Boolean)].join("\n\n")

    // 4. Store user message and reset appended tracking
    const userMessage: UserModelMessage = typeof userPrompt === "string" ? { role: "user", content: userPrompt } : userPrompt
    await memory.store(userMessage)
    await memory.appended() // Reset appended tracking

    let step = 0

    // === AGENTIC LOOP ===
    for (step = 1; step <= MAX_STEPS_HARD_LIMIT; step++) {
      // Check abort signal
      if (env.abort?.aborted) {
        throw new Error("Agent execution was aborted")
      }

      // 5. Read current conversation from memory (filter system messages - provided via JSX)
      const baseMessages = await memory.read().then((m) => m.filter((x) => x.role !== "system"))

      // 6. Enhance with system prompt using JSX engine
      const messagesWithSystem = prompt(<AgentLoopPrompt system={fullSystemPrompt} tools={allTools} messages={baseMessages} />)

      yield node.addEvent({
        type: "agent-step-begin",
        path,
        step,
        system: fullSystemPrompt,
        messages: messagesWithSystem,
      })

      // 7. Convert runners (tools/agents) to AI SDK format with async event queue for real-time merging
      const toolEventQueue = createAsyncEventQueue<RuntimeYield>()
      const tools =
        allTools.length > 0
          ? convertRunnersForAI(allTools, context, env, (event) => {
              toolEventQueue.push(event)
            })
          : undefined

      // 8. Call the LLM
      const result = streamText({
        model: model,
        messages: messagesWithSystem,
        tools,
        providerOptions: providerOptions,
        abortSignal: env.abort,
      })

      // 9. Check if widgets are configured
      const hasWidgets = widgets && widgets.size > 0

      // 10. Stream response and emit events (transform with widget parsing if configured)
      // Use mergeStreamWithQueue to properly interleave tool events with stream events in real-time
      // Queue is automatically closed when the stream completes
      const baseStream = hasWidgets ? transformWidgetStream(result.fullStream, widgets!) : result.fullStream
      const mergedStream = mergeStreamWithQueue(baseStream, toolEventQueue)

      for await (const item of mergedStream) {
        // Check if this is a tool event from the queue (has 'type' property matching tool event types)
        if (isToolEvent(item)) {
          // Yield tool events (e.g., tool-progress, tool-error) directly
          yield node.addEvent(item)
        } else if (item.type === "text-delta") {
          // This is a preamble text-delta from the widget transform
          yield node.addEvent({ type: "agent-stream", path, part: { type: "text-delta", text: item.text } as TextStreamPart<ToolSet> })
        } else if (item.type === "widget-delta") {
          yield node.addEvent({ type: "widget-delta", path, index: item.index, widget: item.widget })
        } else {
          // yield agentNode.addEvent({ type: "agent-stream", path, part: item as TextStreamPart<ToolSet> })
        }
      }

      // 11. Store LLM response messages in memory (tool events are now interleaved above)
      const { messages: newMessages } = await result.response
      for (const message of newMessages) {
        await memory.store(message as ModelMessage)
      }

      const finishReason = await result.finishReason

      // 12. Emit step-end with messages added this step
      const appendedMessages = await memory.appended()

      yield node.addEvent({
        type: "agent-step-end",
        path,
        step,
        finishReason,
        appended: appendedMessages,
      })

      // 13. Check stop condition and break if met
      const shouldStop = await stopCondition({
        step,
        finishReason,
        messages: await memory.read(),
      })

      if (shouldStop) {
        break
      }
    }

    yield node.addEvent({ type: "agent-end", path })

    node.setStatus("completed")
    node.setMessages(await memory.read())
  } catch (error) {
    yield node.addEvent({ type: "agent-error", path, error: error as Error })

    node.setError(error as Error)
    node.setStatus("failed")
    throw error
  }
}
