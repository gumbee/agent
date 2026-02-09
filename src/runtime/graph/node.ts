/**
 * Factory function for creating minimal execution nodes.
 *
 * Nodes are used only for AsyncLocalStorage context tracking,
 * providing id, parent reference, and pre-computed path for events.
 */

import { randomUUID } from "crypto"
import type { Node } from "./types"

/**
 * Creates a minimal execution node with a unique id and pre-computed path.
 * The path is built by appending `name` to the parent's path.
 */
export function createNode(name: string, parent: Node | null = null): Node {
  return {
    id: randomUUID(),
    parent,
    path: parent ? [...parent.path, name] : [name],
  }
}
