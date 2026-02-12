import type { StoreApi } from "zustand"
import type { UiMessage } from "@/features/chat/types"

export type ChatStoreState = {
  chatId: string | null
  messages: UiMessage[]
  streaming: boolean
}

export type ChatStoreActions = {
  createChat: () => Promise<string | null>
  sendMessage: (prompt: string) => Promise<void>
  reset: () => Promise<void>
}

export type ChatStore = ChatStoreState & ChatStoreActions

export type ChatStoreContext = {
  set: StoreApi<ChatStore>["setState"]
  get: StoreApi<ChatStore>["getState"]
}
