import { createChatRecord } from "@/features/backend/chat/db"

/**
 * Creates a new chat session in the backend in-memory store.
 */
export async function POST() {
  const chat = createChatRecord()

  return Response.json({ chatId: chat.id })
}
