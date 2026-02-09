/**
 * Agent factory function for creating agents.
 *
 * Agents run an LLM loop to accomplish tasks. They implement the Runner interface
 * so they can be used as tools by other agents (hierarchical agents).
 */

import type { UserModelMessage } from "ai"
import { randomUUID } from "crypto"
import { SimpleMemory } from "../memory/simple"
import type { Memory } from "../memory"
import { getCurrentNode, getMiddlewares, runWithNode, wrapGeneratorWithNode, wrapGeneratorWithMiddlewares } from "./graph/context"
import { createNode } from "./graph/node"
import type { Node } from "./graph/types"
import { ExecutionGraph } from "./graph/execution-graph"
import type { AgentMiddlewareResult, Middleware } from "./middleware"
import { executeLoop } from "./run-loop"
import { DEFAULT_STOP_CONDITION } from "./stop-conditions"
import {
  type Agent,
  type AgentConfig,
  type AgentLoopContext,
  type AgentResult,
  type AgentRunOptions,
  LazyPromise,
  type RunnerEnvironment,
  type RuntimeYield,
} from "./types"

/**
 * Check if a value is an async generator (has .next method).
 */
function isAsyncGenerator<T, R>(value: AsyncGenerator<T, R> | Promise<R>): value is AsyncGenerator<T, R> {
  return typeof value === "object" && value !== null && "next" in value && typeof (value as any).next === "function"
}

/**
 * Creates an agent with the given configuration.
 *
 * @example
 * ```typescript
 * const myAgent = agent({
 *   name: "assistant",
 *   description: "A helpful assistant",
 *   system: "You are a helpful assistant.",
 *   model: openai("gpt-4o"),
 *   tools: [readFile, writeFile],
 * })
 *
 * const { stream, memory, graph } = myAgent.run("Hello!", context)
 *
 * for await (const event of stream) {
 *   console.log(event)
 * }
 * ```
 */
export const agent = <Context, Input = string | UserModelMessage, Output = { response: string }>(
  config: AgentConfig<Context, Input, Output>,
): Agent<Context, Input, Output> => {
  const stopCondition = config.stopCondition ?? DEFAULT_STOP_CONDITION

  function internalRun(
    agentNode: Node,
    input: Input,
    context: Context,
    memory: Memory,
    options: { abort?: AbortSignal; middleware?: Middleware<Context>[]; runId?: string } = {},
  ): AgentResult<Context> {
    // 2. Create an abort controller for this run
    // If an external signal was provided, wrap it so this run can be independently aborted
    const controller = new AbortController()
    const signal = options.abort ? AbortSignal.any([options.abort, controller.signal]) : controller.signal

    // 3. Build initial env (toolCallId is set to agentNode.id)
    const env: RunnerEnvironment = {
      abort: signal,
      toolCallId: agentNode.id,
      runId: options.runId ?? randomUUID(),
    }

    // 4. Build the context we need to run the agent loop
    const loopContext: AgentLoopContext<Context> = {
      context,
      env,
      memory,
      input,
      toPrompt: config.toPrompt as ((input: unknown) => string | UserModelMessage) | undefined,
      stopCondition,
      model: config.model,
      providerOptions: config.providerOptions,
      system: config.system,
      tools: config.tools,
      widgets: config.widgets,
      widgetsPickerModel: config.widgetsPickerModel,
    }

    // 5. Get inherited middlewares from ancestor context that want to descend into THIS agent
    const inheritedMiddlewares = getMiddlewares<Context>().filter((m) => m.shouldDescendIntoAgent?.(self as unknown as Agent<Context>) ?? false)

    // 6. Combine: inherited first (outermost), then agent's config, then run options (innermost)
    // Order matters for composition - first in array wraps outermost
    const ownMiddlewares = [...(config.middleware ?? []), ...(options.middleware ?? [])]
    const allMiddlewares = [...inheritedMiddlewares, ...ownMiddlewares]

    // 7. Base function: returns an async generator
    // This runs inside the graph context
    async function* base(ctx: AgentLoopContext<Context>): AgentMiddlewareResult<Context> {
      // Wrap executeLoop so each iteration runs within agent node context
      // This is necessary because async generators are lazily evaluated
      const stream = wrapGeneratorWithNode(agentNode, executeLoop(ctx))

      // Yield all events from the stream
      yield* stream

      // Return the final context
      return { context: ctx }
    }

    // 8. Compose middleware using handleAgent (reduceRight so first middleware wraps outermost)
    const wrappedRun = allMiddlewares.reduceRight<typeof base>((next, mw) => (c) => (mw.handleAgent ? mw.handleAgent(c, next) : next(c)), base)

    // 9. Execute within middleware context and graph context
    // The allMiddlewares are now the "active middlewares" for this agent's subtree
    // Tools and subagents will read from this context via getMiddlewares()
    // We must wrap the generator with wrapGeneratorWithMiddlewares to ensure the
    // middleware context is maintained during lazy generator iteration.
    const parentNode = agentNode.parent
    const startGen = () => wrappedRun(loopContext)
    const baseStream = parentNode ? runWithNode(parentNode, startGen) : startGen()
    const middlewareStream = wrapGeneratorWithMiddlewares(allMiddlewares, baseStream)

    // 10. Build ExecutionGraph from events and create context promise
    const graph = new ExecutionGraph()
    const contextPromise = new LazyPromise<AgentLoopContext<Context>>()

    // 11. Wrap the middleware stream to build graph and resolve promises on completion
    const consumerStream: AsyncGenerator<RuntimeYield, void, unknown> = (async function* () {
      let result: IteratorResult<RuntimeYield, { context: AgentLoopContext<Context> }>
      while (!(result = await middlewareStream.next()).done) {
        graph.processEvent(result.value)
        yield result.value
      }
      // Stream completed - resolve the context promise
      contextPromise.resolve(result.value.context)
    })()

    // 12. Return graph with promise for context and abort handle
    return {
      stream: consumerStream,
      graph,
      memory,
      context: contextPromise,
      abort: () => controller.abort(),
    }
  }

  const self: Agent<Context, Input, Output> = {
    __runner__: true,
    name: config.name,
    description: config.description,
    instructions: config.instructions,
    input: config.input,

    /**
     * Execute the agent (used when agent is called as a sub-agent/tool)
     */
    execute: async function* (input: Input, context: Context, env: RunnerEnvironment) {
      // Create the agent node BEFORE anything else
      const parent = getCurrentNode() ?? null
      const agentNode = createNode(config.name, parent)
      const memory = config.memory ?? new SimpleMemory()

      if (config.execute) {
        // if we provided a custom execut method, prepare the run function to be passed to the execute function to run the agent loop
        const run = (input: Input) => {
          return internalRun(agentNode, input, context, memory, { abort: env.abort, runId: env.runId })
        }

        // execute the custom execute function
        const result = config.execute(run, input, context, { ...env, toolCallId: agentNode.id })

        if (isAsyncGenerator(result)) {
          // if the custom execute function is an async generator, yield the results
          // Wrap so getCurrentNode() returns agentNode inside the custom generator
          const wrapped = wrapGeneratorWithNode(agentNode, result)

          let next = await wrapped.next()
          while (!next.done) {
            const event = next.value
            yield {
              path: agentNode.path,
              timestamp: performance.now(),
              nodeId: agentNode.id,
              parentId: agentNode.parent?.id,
              ...(event as any),
            } as RuntimeYield
            next = await wrapped.next()
          }

          return next.value
        }

        // if the custom execute function is a promise, await the result
        return await result
      }

      // if we didn't provide a custom execute function, run the agent loop directly with the input
      const { stream, memory: mem } = internalRun(agentNode, input, context, memory, { abort: env.abort, runId: env.runId })

      yield* stream

      // Extract the response from appended messages (per default, result is last assistant message)
      const response = await mem.appended().then((x) => x.findLast((m) => m.role === "assistant")?.content)

      return (
        typeof response === "string"
          ? { response }
          : {
              response:
                response
                  ?.filter((m) => m.type === "text")
                  ?.map((m) => m.text)
                  .join("") ?? "No response from agent",
            }
      ) as Output
    },

    /**
     * Run the agent as the root agent.
     * Returns a result with stream, memory, graph, and node.
     */
    run(input: Input, context: Context, options: AgentRunOptions = {}): AgentResult {
      // Memory fallback chain: run options -> agent config -> new SimpleMemory
      const memory = options.memory ?? config.memory ?? new SimpleMemory()

      // 1. Get existing parent or create minimal root node
      // If we're running inside an existing graph context (e.g., called from within a tool),
      // use that as our parent. Otherwise, create a new root node.
      const existingParent = getCurrentNode() ?? null
      const agentNode = createNode(config.name, existingParent)

      return internalRun(agentNode, input, context, memory, { ...options, runId: randomUUID() })
    },
  }

  return self
}
