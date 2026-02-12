import type { ChatStoreContext } from "@/features/chat/store/types"

/**
 * Resets local client state. A new chat is created lazily on next send.
 */
export function resetAction({ set }: ChatStoreContext) {
  return async (): Promise<void> => {
    set({ chatId: null, messages: [], streaming: false })
  }
}
