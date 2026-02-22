import { SimpleMemory } from "../memory/simple"
import type { Memory } from "../memory"
import { ExecutionGraph } from "./graph/execution-graph"
import type { Agent, AgentLoopContext, AgentResult, AgentRunOptions, RuntimeYield, WithMetadata } from "./types"
import { LazyPromise } from "./types"

/**
 * Wrap an agent so it can run with a different parent context type.
 *
 * This is useful when a parent agent and a sub-agent use incompatible context
 * shapes. The wrapper keeps the same agent identity (name/description/input)
 * and maps context before delegation.
 */
export function handoff<ExternalContext, InternalContext, Input = string, Output = { response: string }, Custom extends { type: string } = never>(
  targetAgent: Agent<InternalContext, Input, Output, Custom>,
  mapContext: (context: ExternalContext) => InternalContext | Promise<InternalContext>,
): Agent<ExternalContext, Input, Output, Custom> {
  return {
    ...targetAgent,
    __runner__: true,
    name: targetAgent.name,
    description: targetAgent.description,
    instructions: targetAgent.instructions,
    input: targetAgent.input as Agent<ExternalContext, Input, Output, Custom>["input"],

    execute: async function* (input: Input, context: ExternalContext, env) {
      const internalContext = await mapContext(context)
      return yield* targetAgent.execute(input, internalContext, env)
    },

    run(input: Input, context: ExternalContext, options: AgentRunOptions<ExternalContext> = {}): AgentResult<ExternalContext, Custom> {
      const graph = new ExecutionGraph()
      const contextPromise = new LazyPromise<AgentLoopContext<ExternalContext>>()
      const controller = new AbortController()
      const signal = options.abort ? AbortSignal.any([options.abort, controller.signal]) : controller.signal

      let memoryRef: Memory = options.memory ?? new SimpleMemory()

      const stream: AsyncGenerator<WithMetadata<RuntimeYield<Custom>>, void, unknown> = (async function* () {
        try {
          const internalContext = await mapContext(context)
          const runOptions: AgentRunOptions<InternalContext> = {
            abort: signal,
            middleware: options.middleware as AgentRunOptions<InternalContext>["middleware"],
            ...(options.memory ? { memory: options.memory } : {}),
          }

          const delegated = targetAgent.run(input, internalContext, runOptions)
          memoryRef = delegated.memory

          let next = await delegated.stream.next()
          while (!next.done) {
            graph.processEvent(next.value)
            yield next.value
            next = await delegated.stream.next()
          }

          const delegatedContext = await delegated.context
          contextPromise.resolve({
            ...delegatedContext,
            context,
          } as AgentLoopContext<ExternalContext>)
        } catch (error) {
          contextPromise.reject(error)
          throw error
        }
      })()

      return {
        stream,
        graph,
        get memory() {
          return memoryRef
        },
        context: contextPromise,
        abort: () => controller.abort(),
      } as AgentResult<ExternalContext, Custom>
    },
  }
}
