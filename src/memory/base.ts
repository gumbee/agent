import type { ModelMessage } from "../runtime/types"

export interface Memory {
  read(): Promise<ModelMessage[]>
  store(message: ModelMessage): void | Promise<void>
  appended(): Promise<ModelMessage[]>
}
