import type { ModelMessage } from "../runtime/types"
import { estimateMessageTokens } from "../utils/token-estimator"
import type { Memory } from "./base"

export type TokenWindowMemoryOptions = {
  maxTokens?: number
}

/**
 * A memory implementation that keeps a sliding window of messages based on estimated token count.
 *
 * It trims the conversation history to fit within a specified token limit (`maxTokens`),
 * using a heuristic token estimator.
 *
 * Key features:
 * - Keeps the most recent messages that fit within `maxTokens` (default: 128000)
 * - Automatically adjusts the window start to avoid splitting tool-call / tool-result pairs.
 * - Uses `estimateTokenCount` for heuristic token estimation (not an exact tokenizer).
 */
export class TokenWindowMemory implements Memory {
  private messages: ModelMessage[] = []
  private initialCount = 0
  private maxTokens: number

  constructor(messages: ModelMessage[] = [], options: TokenWindowMemoryOptions = {}) {
    this.messages = [...messages]
    this.initialCount = this.messages.length
    this.maxTokens = options.maxTokens ?? 128000
  }

  async read(): Promise<ModelMessage[]> {
    let currentTokens = 0
    let startIndex = this.messages.length

    // Walk backwards accumulating tokens
    while (startIndex > 0) {
      const message = this.messages[startIndex - 1]!
      const tokens = estimateMessageTokens(message)

      if (currentTokens + tokens > this.maxTokens) {
        break
      }

      currentTokens += tokens
      startIndex--
    }

    // Walk backwards to avoid splitting tool-call / tool-result pairs.
    // If the window starts on a "tool" message, the corresponding
    // assistant message with the tool-call is outside the window,
    // which would cause an API error.
    while (startIndex > 0 && startIndex < this.messages.length && this.messages[startIndex]?.role === "tool") {
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
