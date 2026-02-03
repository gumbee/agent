/**
 * Agent factory function for creating agents.
 *
 * Agents run an LLM loop to accomplish tasks. They implement the Runner interface
 * so they can be used as tools by other agents (hierarchical agents).
 */

import type { UserModelMessage } from "ai"
import { SimpleMemory } from "../memory/simple"
import { getCurrentNode, getMiddlewares, runWithMiddlewares, runWithNode, wrapGeneratorWithNode } from "./graph/context"
import { createAgentNode, createRootNode } from "./graph/node"
import type { AgentMiddlewareResult } from "./middleware"
import { executeLoop } from "./run-loop"
import { DEFAULT_STOP_CONDITION } from "./stop-conditions"
import {
  type Agent,
  type AgentConfig,
  type AgentLoopContext,
  type AgentResult,
  type AgentRunOptions,
  createRef,
  type RunnerEnvironment,
} from "./types"

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
 * const { stream, memory, graph, node } = myAgent.run("Hello!", context)
 *
 * for await (const event of stream) {
 *   console.log(event)
 * }
 * ```
 */
export const agent = <Context = {}>(config: AgentConfig<Context>): Agent<Context> => {
  const stopCondition = config.stopCondition ?? DEFAULT_STOP_CONDITION

  return {
    __runner__: true,
    name: config.name,
    description: config.description,
    instructions: config.instructions,

    /**
     * Execute the agent (used when agent is called as a sub-agent/tool)
     */
    execute: async function* (input: string, context: Context, env: RunnerEnvironment) {
      const { stream, memory } = this.run(input, context, env)

      yield* stream

      // Extract the response from appended messages
      const response = await memory.appended().then((x) => x.findLast((m) => m.role === "assistant")?.content)

      return typeof response === "string"
        ? { response }
        : {
            response:
              response
                ?.filter((m) => m.type === "text")
                ?.map((m) => m.text)
                .join("") ?? "No response from agent",
          }
    },

    /**
     * Run the agent as the root agent.
     * Returns a result with stream, memory, graph, and node.
     */
    run(prompt: string | UserModelMessage, context: Context, options: AgentRunOptions = {}): AgentResult {
      // Memory fallback chain: run options -> agent config -> new SimpleMemory
      const memory = options.memory ?? config.memory ?? new SimpleMemory()
      const promptStr = typeof prompt === "string" ? prompt : prompt.content.toString()

      // Reference to this agent for shouldDescendIntoAgent checks
      const thisAgent = this

      // 1. Get existing parent or create root node
      // If we're running inside an existing graph context (e.g., called from within a tool),
      // use that as our graph. Otherwise, create a new root node.
      const existingParent = getCurrentNode() ?? null
      const graph = existingParent ?? createRootNode(config.name)

      // 2. Build initial env (toolCallId will be updated in base when agent node is created)
      const env: RunnerEnvironment = {
        abort: options.abort,
        toolCallId: "", // Will be set in base function when agent node is created
      }

      // 3. Build the context we need to run the agent loop (agent node created in base)
      const loopContext: AgentLoopContext<Context> = {
        context,
        env,
        memory,
        prompt,
        stopCondition,
        model: config.model,
        providerOptions: config.providerOptions,
        system: config.system,
        tools: config.tools,
        widgets: config.widgets,
        widgetsPickerModel: config.widgetsPickerModel,
      }

      // 4. Get inherited middlewares from ancestor context that want to descend into THIS agent
      const inheritedMiddlewares = getMiddlewares<Context>().filter((m) => m.shouldDescendIntoAgent?.(thisAgent) ?? false)

      // 5. Combine: inherited first (outermost), then agent's config, then run options (innermost)
      // Order matters for composition - first in array wraps outermost
      const ownMiddlewares = [...(config.middleware ?? []), ...(options.middleware ?? [])]
      const allMiddlewares = [...inheritedMiddlewares, ...ownMiddlewares]

      // 6. Base function: creates agent node and wraps executeLoop
      // This runs inside the graph context, so getCurrentNode() returns the graph/root
      const base = (ctx: AgentLoopContext<Context>): AgentMiddlewareResult<Context> => {
        // Create agent node as child of current node (graph/root or existing parent)
        const parent = getCurrentNode() ?? null
        const agentNode = createAgentNode(config.name, promptStr, parent)

        // Update env with the new node's ID
        const nodeEnv: RunnerEnvironment = { ...ctx.env, toolCallId: agentNode.id }
        const nodeCtx = { ...ctx, env: nodeEnv }

        // Wrap executeLoop so each iteration runs within agent node context
        // This is necessary because async generators are lazily evaluated
        const stream = wrapGeneratorWithNode(agentNode, executeLoop(nodeCtx))

        return {
          context: createRef(nodeCtx),
          stream,
          node: createRef(agentNode),
        }
      }

      // 7. Compose middleware using handleAgent (reduceRight so first middleware wraps outermost)
      const wrappedRun = allMiddlewares.reduceRight<typeof base>(
        (next, mw) => (c) => (mw.handleAgent ? mw.handleAgent(c, next) : next(c)),
        base,
      )

      // 8. Execute within middleware context and graph context
      // The allMiddlewares are now the "active middlewares" for this agent's subtree
      // Tools and subagents will read from this context via getMiddlewares()
      const result = runWithMiddlewares(allMiddlewares, () => runWithNode(graph, () => wrappedRun(loopContext)))

      // 9. Return graph with getters for node/context that read from internal refs
      // Middleware can update the refs during stream consumption (e.g., retry middleware)
      // but consumers see clean types without the Ref wrapper
      return {
        stream: result.stream,
        graph,
        get memory() {
          return result.context.current.memory
        },
        get node() {
          return result.node.current
        },
        get context() {
          return result.context.current
        },
      }
    },
  }
}
