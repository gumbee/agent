import { type ModelMessage, type UserModelMessage, streamText, type TextStreamPart, type ToolSet } from "ai"
import { getCurrentNode, getMiddlewares } from "./graph/context"
import { createAsyncEventQueue, mergeStreamWithQueue } from "./merge-streams"
import type { AgentStepMiddlewareContext, AgentStepMiddlewareResult, Middleware } from "./middleware"
import { convertRunnersForAI } from "./tool"
import { createWidgetSchemaTool } from "./tool-definitions/widget-schema-tool"
import { transformWidgetStream } from "./widgets-transform"
import type { RuntimeYield, Runner, AgentLoopContext, FinishReason } from "./types"

/** Check if an item is a RuntimeYield event (from sub-agent/tool queue) vs a base stream part */
function isRuntimeYield(item: unknown): item is RuntimeYield {
  return typeof item === "object" && item !== null && "path" in item && "timestamp" in item
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
  const { path, nodeId, model, tools: baseTools, widgets, widgetsPickerModel, providerOptions, env, context, memory } = c

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
    timestamp: performance.now(),
    nodeId,
    system: fullSystemPrompt,
    messages,
    modelId,
    provider,
    providerOptions,
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
    // Check if this is a runtime yield from the queue (has 'path' and 'timestamp')
    if (isRuntimeYield(item)) {
      // Yield runtime events (e.g., tool events, sub-agent events) directly
      yield item
    } else if (item.type === "text-delta") {
      // Yield text delta as agent-stream event with path
      yield {
        type: "agent-stream",
        path,
        timestamp: performance.now(),
        nodeId,
        part: { type: "text-delta", text: item.text } as TextStreamPart<ToolSet>,
      }
    } else if (item.type === "widget-delta") {
      // Yield widget delta with path
      yield { type: "widget-delta", path, timestamp: performance.now(), nodeId, index: item.index, widget: item.widget }
    } else if (item.type === "finish-step") {
      // Yield finish-step as agent-stream event with path
      yield {
        type: "agent-stream",
        path,
        timestamp: performance.now(),
        nodeId,
        part: item as TextStreamPart<ToolSet>,
      }
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
  // Get current node from context
  const node = getCurrentNode()

  if (!node) throw new Error("executeLoop must run within a node context")

  const { id: nodeId, path } = node

  yield {
    type: "agent-begin",
    path,
    timestamp: performance.now(),
    nodeId,
    parentId: node.parent?.id,
    name: path[path.length - 1] ?? "agent",
    input: data.input,
  }

  try {
    // Convert input to user message and store in memory
    const prompt = data.toPrompt ? data.toPrompt(data.input) : data.input
    const userMessage: UserModelMessage = typeof prompt === "string" ? { role: "user", content: prompt } : (prompt as UserModelMessage)
    await memory.store(userMessage)

    // === INITIALIZATION ===

    // 1. Collect base tools (widget schema tool is added per-step in executeStep to use potentially modified model)
    const baseTools: Runner<Context>[] = [...(tools ?? [])]

    // 2. Get middlewares and compose step middleware chain
    const middlewares = getMiddlewares<Context>()
    const wrappedStep = composeStepMiddleware(middlewares, executeStep)

    let step = 0

    // === AGENTIC LOOP ===
    while (true) {
      // Check abort signal
      if (env.abort?.aborted) {
        throw new Error("Agent execution was aborted")
      }

      // Emit step-begin (outside middleware chain)
      yield { type: "agent-step-begin", path, timestamp: performance.now(), nodeId, step }

      // Build step context for middleware chain (step and path are readonly, not modifiable by middleware)
      // Note: executeStep builds system prompt, reads messages from memory, adds widget tool, and stores messages
      const stepContext: AgentStepMiddlewareContext<Context> = {
        step,
        nodeId,
        path,
        input: data.input,
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
        yield stepResult.value
      }

      // Get finish reason and appended messages for step-end event
      const finishReason = stepResult.value
      const appendedMessages = await memory.appended()

      // Emit step-end (outside middleware chain)
      yield { type: "agent-step-end", path, timestamp: performance.now(), nodeId, step, finishReason, appended: appendedMessages }

      // Check stop condition and break if met
      const shouldStop = await stopCondition({
        step,
        finishReason,
        messages: await memory.read(),
      })

      if (shouldStop) {
        break
      }

      step++
    }

    yield { type: "agent-end", path, timestamp: performance.now(), nodeId }
  } catch (error) {
    yield { type: "agent-error", path, timestamp: performance.now(), nodeId, error: error as Error }
    throw error
  }
}
