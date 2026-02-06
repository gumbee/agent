import type { ModelMessage } from "../runtime/types"
import type { Memory } from "./base"

export type SlidingWindowMemoryOptions = {
  windowSize?: number
}

/**
 * A memory implementation that keeps a sliding window of the most recent messages.
 *
 * It trims the conversation history based on the number of messages (`windowSize`),
 * ensuring that the context stays within manageable limits.
 *
 * Key features:
 * - Keeps the most recent N messages (default: 30)
 * - Automatically adjusts the window start to avoid splitting tool-call / tool-result pairs,
 *   which would otherwise cause API errors.
 */
export class SlidingWindowMemory implements Memory {
  private messages: ModelMessage[] = []
  private initialCount = 0
  private windowSize: number

  constructor(messages: ModelMessage[] = [], options: SlidingWindowMemoryOptions = {}) {
    this.messages = [...messages]
    this.initialCount = this.messages.length
    this.windowSize = options.windowSize ?? 30
  }

  async read(): Promise<ModelMessage[]> {
    if (this.messages.length <= this.windowSize) {
      return [...this.messages]
    }

    // Find the naive start index
    let startIndex = this.messages.length - this.windowSize

    // Walk backwards to avoid splitting tool-call / tool-result pairs.
    // If the window starts on a "tool" message, the corresponding
    // assistant message with the tool-call is outside the window,
    // which would cause an API error.
    while (startIndex > 0 && this.messages[startIndex]!.role === "tool") {
      startIndex--
    }

    return this.messages.slice(startIndex)
  }

  async store(message: ModelMessage): Promise<void> {
    this.messages.push(message)
  }

  async appended(): Promise<ModelMessage[]> {
    return this.messages.slice(this.initialCount)
  }
}
