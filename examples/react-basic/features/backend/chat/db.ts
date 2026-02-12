import "server-only"

import type { ModelMessage } from "ai"

type ChatRecord = {
  id: string
  messages: ModelMessage[]
}

const chats = new Map<string, ChatRecord>()

/**
 * Creates a new chat record in the in-memory database.
 */
export function createChatRecord(): ChatRecord {
  const id = crypto.randomUUID()
  const chat: ChatRecord = {
    id,
    messages: [],
  }

  chats.set(id, chat)
  return chat
}

/**
 * Reads a chat by ID from the in-memory database.
 */
export function getChatRecord(chatId: string): ChatRecord | null {
  return chats.get(chatId) ?? null
}

/**
 * Appends newly generated model messages to an existing chat record.
 */
export function appendChatMessages(chatId: string, messages: ModelMessage[]): ChatRecord | null {
  const chat = chats.get(chatId)
  if (!chat) return null

  chat.messages.push(...messages)
  return chat
}
