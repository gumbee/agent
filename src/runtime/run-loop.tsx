import { type ModelMessage, streamText, type TextStreamPart, type ToolSet } from "ai"
import { getCurrentNode, getMiddlewares, getPath } from "./graph/context"
import { createAsyncEventQueue, mergeStreamWithQueue } from "./merge-streams"
import type { AgentStepMiddlewareContext, AgentStepMiddlewareResult, Middleware } from "./middleware"
import { convertRunnersForAI } from "./tool"
import { createWidgetSchemaTool } from "./tool-definitions/widget-schema-tool"
import { transformWidgetStream } from "./widgets-transform"
import type { RuntimeYield, Runner, AgentLoopContext, FinishReason } from "./types"

/** Hard limit to prevent infinite loops if stop condition is misconfigured */
const MAX_STEPS_HARD_LIMIT = 100

/** Tool event types that can come from the event queue */
const TOOL_EVENT_TYPES = new Set(["tool-begin", "tool-end", "tool-error", "tool-progress"])

/** Check if an item is a tool event (from the event queue) vs a stream part */
function isToolEvent(item: unknown): item is RuntimeYield {
  return typeof item === "object" && item !== null && "type" in item && TOOL_EVENT_TYPES.has((item as { type: string }).type)
}

/**
 * Compose step middleware chain.
 * Reduces middlewares right-to-left so first middleware wraps outermost.
 */
function composeStepMiddleware<Context>(
  middlewares: Middleware<Context>[],
  base: (c: AgentStepMiddlewareContext<Context>) => AgentStepMiddlewareResult,
): (c: AgentStepMiddlewareContext<Context>) => AgentStepMiddlewareResult {
  return middlewares.reduceRight<(c: AgentStepMiddlewareContext<Context>) => AgentStepMiddlewareResult>(
    (next, mw) => (c) => (mw.handleAgentStep ? mw.handleAgentStep(c, next) : next(c)),
    base,
  )
}

/**
 * Execute a single LLM step. This is the base function that middleware wraps.
 * Emits agent-step-llm-call event, streams the response, stores messages, and returns the finish reason.
 */
async function* executeStep<Context>(c: AgentStepMiddlewareContext<Context>): AgentStepMiddlewareResult {
  const { path, model, tools: baseTools, widgets, widgetsPickerModel, providerOptions, env, context, memory } = c

  // Collect all tools including widget schema tool (uses c.model which may be modified by middleware)
  const allTools: Runner<Context>[] = [...baseTools]

  if (widgets && widgets.size > 0) {
    const widgetTool = createWidgetSchemaTool(widgets, widgetsPickerModel ?? model) as Runner<Context>
    allTools.push(widgetTool)
  }

  // Build full system prompt from system method, base tools, and widget tool
  const baseSystemPrompt = typeof c.system === "function" ? await c.system(context) : (c.system ?? "")
  const toolInstructions = allTools.map((tool) => tool.instructions).filter(Boolean)
  const fullSystemPrompt = [baseSystemPrompt, ...toolInstructions].join("\n\n")

  // Read messages from memory and construct with our system prompt (filter out existing system messages)
  const baseMessages = await memory.read().then((m) => m.filter((x) => x.role !== "system"))
  const messages: ModelMessage[] = [{ role: "system", content: fullSystemPrompt }, ...baseMessages]

  // Emit LLM call event with final system prompt, messages, and model info
  // Access model info safely - LanguageModel is an object with modelId/provider at runtime
  const modelId = typeof model === "object" && "modelId" in model ? model.modelId : String(model)
  const provider = typeof model === "object" && "provider" in model ? model.provider : "unknown"

  yield {
    type: "agent-step-llm-call",
    path,
    system: fullSystemPrompt,
    messages,
    modelId,
    provider,
  }

  // Convert runners (tools/agents) to AI SDK format with async event queue for real-time merging
  const toolEventQueue = createAsyncEventQueue<RuntimeYield>()
  const tools =
    allTools.length > 0
      ? convertRunnersForAI(allTools, context, env, (event) => {
          toolEventQueue.push(event)
        })
      : undefined

  // Call the LLM
  const result = streamText({
    model: model,
    messages: messages,
    tools,
    providerOptions: providerOptions,
    abortSignal: env.abort,
  })

  // Check if widgets are configured
  const hasWidgets = widgets && widgets.size > 0

  // Stream response and emit events (transform with widget parsing if configured)
  // Use mergeStreamWithQueue to properly interleave tool events with stream events in real-time
  // Queue is automatically closed when the stream completes
  const baseStream = hasWidgets ? transformWidgetStream(result.fullStream, widgets!) : result.fullStream
  const mergedStream = mergeStreamWithQueue(baseStream, toolEventQueue)

  for await (const item of mergedStream) {
    // Check if this is a tool event from the queue (has 'type' property matching tool event types)
    if (isToolEvent(item)) {
      // Yield tool events (e.g., tool-progress, tool-error) directly
      yield item
    } else if (item.type === "text-delta") {
      // Yield text delta as agent-stream event with path
      yield { type: "agent-stream", path, part: { type: "text-delta", text: item.text } as TextStreamPart<ToolSet> }
    } else if (item.type === "widget-delta") {
      // Yield widget delta with path
      yield { type: "widget-delta", path, index: item.index, widget: item.widget }
    }
  }

  // Get the response and finish reason
  const { messages: newMessages } = await result.response
  const finishReason = (await result.finishReason) as FinishReason

  // Store new messages in memory
  for (const message of newMessages) {
    await memory.store(message as ModelMessage)
  }

  return finishReason
}

/**
 * Core execution generator that runs the agentic loop.
 * This is used both by run() for root agents and by execute() for sub-agents.
 *
 * Keeps JSX prompt enhancement and widget support while using the simplified
 * graph-based trace system.
 */
export async function* executeLoop<Context>(data: AgentLoopContext<Context>): AsyncGenerator<RuntimeYield, void, unknown> {
  const { system, tools, context, env, memory, widgets, widgetsPickerModel, model, providerOptions, stopCondition } = data
  // Get current node from context, or create new one for sub-agents
  const node = getCurrentNode()

  if (!node || node.type !== "agent") throw new Error("executeLoop must run within an agent node context")

  const path = getPath(node)

  node.setStatus("running")

  yield node.addEvent({ type: "agent-begin", path })

  try {
    // === INITIALIZATION ===

    // 1. Collect base tools (widget schema tool is added per-step in executeStep to use potentially modified model)
    const baseTools: Runner<Context>[] = [...(tools ?? [])]

    // 2. Get middlewares and compose step middleware chain
    const middlewares = getMiddlewares<Context>()
    const wrappedStep = composeStepMiddleware(middlewares, executeStep)

    let step = 0

    // === AGENTIC LOOP ===
    for (step = 1; step <= MAX_STEPS_HARD_LIMIT; step++) {
      // Check abort signal
      if (env.abort?.aborted) {
        throw new Error("Agent execution was aborted")
      }

      // Emit step-begin (outside middleware chain)
      yield node.addEvent({ type: "agent-step-begin", path, step })

      // Build step context for middleware chain (step and path are readonly, not modifiable by middleware)
      // Note: executeStep builds system prompt, reads messages from memory, adds widget tool, and stores messages
      const stepContext: AgentStepMiddlewareContext<Context> = {
        step,
        path,
        system: system ?? "",
        model,
        tools: baseTools,
        widgets,
        widgetsPickerModel,
        providerOptions,
        env,
        memory,
        context,
      }

      // Execute step through middleware chain, yielding all events
      const stepStream = wrappedStep(stepContext)
      let stepResult: IteratorResult<RuntimeYield, FinishReason>

      while (!(stepResult = await stepStream.next()).done) {
        // Events already have path set, just add to node and yield
        yield node.addEvent(stepResult.value)
      }

      // Get finish reason and appended messages for step-end event
      const finishReason = stepResult.value
      const appendedMessages = await memory.appended()

      // Emit step-end (outside middleware chain)
      yield node.addEvent({ type: "agent-step-end", path, step, finishReason, appended: appendedMessages })

      // Check stop condition and break if met
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
