"use client"

import { create } from "zustand"
import { createChatAction } from "@/features/chat/store/createChat"
import { resetAction } from "@/features/chat/store/reset"
import { sendMessageAction } from "@/features/chat/store/sendMessage"
import type { ChatStore } from "@/features/chat/store/types"

/**
 * Main Zustand store for the chat feature.
 * Actions are split into dedicated files for clarity and reuse.
 */
export const useChatStore = create<ChatStore>((set, get) => ({
  chatId: null,
  messages: [],
  streaming: false,
  createChat: createChatAction({ set, get }),
  sendMessage: sendMessageAction({ set, get }),
  reset: resetAction({ set, get }),
}))
