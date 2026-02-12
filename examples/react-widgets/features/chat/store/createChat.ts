import type { ChatStoreContext } from "@/features/chat/store/types"

/**
 * Creates a new server chat session and stores the returned chat ID.
 */
export function createChatAction({ set }: ChatStoreContext) {
  return async (): Promise<string | null> => {
    const response = await fetch("/api/chats", { method: "POST" })

    if (!response.ok) return null

    const data = (await response.json()) as { chatId: string }

    set({ chatId: data.chatId })

    return data.chatId
  }
}
