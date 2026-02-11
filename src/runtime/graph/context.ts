/**
 * AsyncLocalStorage-based context for graph and middleware propagation.
 *
 * This enables automatic parent-child relationship tracking and middleware
 * inheritance across async boundaries without explicit parameter passing.
 */

import { AsyncLocalStorage } from "async_hooks"
import type { Middleware } from "../middleware"
import type { Agent } from "../types"
import type { Node } from "./types"

export type MiddlewareEntry<Context = any> = {
  middleware: Middleware<Context, any>
  origin: Agent<Context>
}

// Stores the current node in the execution context
export const graphNodeStorage: AsyncLocalStorage<Node> = new AsyncLocalStorage<Node>()

// Stores the currently executing agent for propagation decisions
export const agentStorage: AsyncLocalStorage<Agent<any>> = new AsyncLocalStorage<Agent<any>>()

// Stores the active middleware entries for the current subtree
export const middlewareStorage: AsyncLocalStorage<MiddlewareEntry<any>[]> = new AsyncLocalStorage<MiddlewareEntry<any>[]>()

/**
 * Get current node from context (undefined if not in graph execution)
 */
export function getCurrentNode(): Node | undefined {
  return graphNodeStorage.getStore()
}

/**
 * Run function with a node as the current context.
 * All code executed within fn (including async operations) will
 * see this node as the current node.
 */
export function runWithNode<T>(node: Node, fn: () => T): T {
  return graphNodeStorage.run(node, fn)
}

/**
 * Get current agent from context (undefined if not in agent execution).
 */
export function getCurrentAgent<Context = any>(): Agent<Context> | undefined {
  return agentStorage.getStore() as Agent<Context> | undefined
}

/**
 * Generic helper that wraps an async generator so each iteration
 * runs within the given AsyncLocalStorage context.
 *
 * This is necessary because async generators are lazily evaluated — the code
 * inside the generator only runs when .next() is called, which may be outside
 * the original storage.run() scope.
 */
async function* wrapGeneratorWithStorage<S, T, TReturn>(
  storage: AsyncLocalStorage<S>,
  value: S,
  generator: AsyncGenerator<T, TReturn, unknown>,
): AsyncGenerator<T, TReturn, unknown> {
  try {
    while (true) {
      const result = await storage.run(value, () => generator.next())
      if (result.done) {
        return result.value
      }
      yield result.value
    }
  } finally {
    // Ensure cleanup runs in context if generator is closed early
    await storage.run(value, () => generator.return(undefined as TReturn))
  }
}

/**
 * Wrap an async generator so each iteration runs within the agent context.
 */
export function wrapGeneratorWithAgent<T, TReturn>(
  agent: Agent<any>,
  generator: AsyncGenerator<T, TReturn, unknown>,
): AsyncGenerator<T, TReturn, unknown> {
  return wrapGeneratorWithStorage(agentStorage, agent, generator)
}

/**
 * Wrap an async generator so each iteration runs within the node context.
 */
export function wrapGeneratorWithNode<T, TReturn>(node: Node, generator: AsyncGenerator<T, TReturn, unknown>): AsyncGenerator<T, TReturn, unknown> {
  return wrapGeneratorWithStorage(graphNodeStorage, node, generator)
}

// =============================================================================
// Middleware API
// =============================================================================

/**
 * Get current middlewares from AsyncLocalStorage.
 * These are the "active middlewares" for the current subtree.
 * Returns empty array if no middlewares are registered.
 */
export function getMiddlewares<Context = any>(): Middleware<Context, any>[] {
  return getMiddlewareEntries<Context>().map((entry) => entry.middleware)
}

/**
 * Get current middleware entries from AsyncLocalStorage.
 * Returns empty array if no middleware entries are registered.
 */
export function getMiddlewareEntries<Context = any>(): MiddlewareEntry<Context>[] {
  return (middlewareStorage.getStore() ?? []) as MiddlewareEntry<Context>[]
}

/**
 * Run function with the given middleware entries as the active set.
 * Used when entering an agent to establish its subtree's middleware context.
 * All code executed within fn (including async operations) will
 * have access to these middleware entries via getMiddlewareEntries().
 */
export function runWithMiddlewares<T>(entries: MiddlewareEntry<any>[], fn: () => T): T {
  return middlewareStorage.run(entries, fn)
}

/**
 * Wrap an async generator so each iteration runs within the middleware context.
 */
export function wrapGeneratorWithMiddlewares<T, TReturn>(
  entries: MiddlewareEntry<any>[],
  generator: AsyncGenerator<T, TReturn, unknown>,
): AsyncGenerator<T, TReturn, unknown> {
  return wrapGeneratorWithStorage(middlewareStorage, entries, generator)
}
