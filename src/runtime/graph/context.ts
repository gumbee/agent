/**
 * AsyncLocalStorage-based context for graph and middleware propagation.
 *
 * This enables automatic parent-child relationship tracking and middleware
 * inheritance across async boundaries without explicit parameter passing.
 */

import { AsyncLocalStorage } from "async_hooks"
import type { Middleware } from "../middleware"
import type { Node } from "./types"

// Stores the current node in the execution context
export const graphNodeStorage: AsyncLocalStorage<Node> = new AsyncLocalStorage<Node>()

// Stores the active middlewares for the current subtree
export const middlewareStorage: AsyncLocalStorage<Middleware[]> = new AsyncLocalStorage<Middleware[]>()

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
 * Wrap an async generator so each iteration runs within the node context.
 * This is necessary because async generators are lazily evaluated - the code
 * inside the generator only runs when .next() is called, which may be outside
 * the original runWithNode scope.
 */
export async function* wrapGeneratorWithNode<T, TReturn>(
  node: Node,
  generator: AsyncGenerator<T, TReturn, unknown>,
): AsyncGenerator<T, TReturn, unknown> {
  try {
    while (true) {
      const result = await graphNodeStorage.run(node, () => generator.next())
      if (result.done) {
        return result.value
      }
      yield result.value
    }
  } finally {
    // Ensure cleanup runs in context if generator is closed early
    await graphNodeStorage.run(node, () => generator.return(undefined as TReturn))
  }
}

// =============================================================================
// Middleware API
// =============================================================================

/**
 * Get current middlewares from AsyncLocalStorage.
 * These are the "active middlewares" for the current subtree.
 * Returns empty array if no middlewares are registered.
 */
export function getMiddlewares<Context = any>(): Middleware<Context>[] {
  return (middlewareStorage.getStore() ?? []) as Middleware<Context>[]
}

/**
 * Run function with the given middlewares as the active set.
 * Used when entering an agent to establish its subtree's middleware context.
 * All code executed within fn (including async operations) will
 * have access to these middlewares via getMiddlewares().
 */
export function runWithMiddlewares<T>(middlewares: Middleware[], fn: () => T): T {
  return middlewareStorage.run(middlewares, fn)
}

/**
 * Wrap an async generator so each iteration runs within the middleware context.
 * This is necessary because async generators are lazily evaluated - the code
 * inside the generator only runs when .next() is called, which may be outside
 * the original runWithMiddlewares scope.
 */
export async function* wrapGeneratorWithMiddlewares<T, TReturn>(
  middlewares: Middleware[],
  generator: AsyncGenerator<T, TReturn, unknown>,
): AsyncGenerator<T, TReturn, unknown> {
  try {
    while (true) {
      const result = await middlewareStorage.run(middlewares, () => generator.next())
      if (result.done) {
        return result.value
      }
      yield result.value
    }
  } finally {
    // Ensure cleanup runs in context if generator is closed early
    await middlewareStorage.run(middlewares, () => generator.return(undefined as TReturn))
  }
}
