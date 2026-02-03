import type { ModelMessage } from "../runtime/types"
import type { Memory } from "./base"

export class SimpleMemory implements Memory {
  private messages: ModelMessage[] = []
  private initialCount = 0

  constructor(messages: ModelMessage[] = []) {
    this.messages = [...messages]
    this.initialCount = this.messages.length
  }

  async read(): Promise<ModelMessage[]> {
    return [...this.messages]
  }

  async store(message: ModelMessage): Promise<void> {
    this.messages.push(message)
  }

  async appended(): Promise<ModelMessage[]> {
    return this.messages.slice(this.initialCount)
  }
}
