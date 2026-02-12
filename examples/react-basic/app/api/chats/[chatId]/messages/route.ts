import { SimpleMemory } from "@gumbee/agent"
import { appendChatMessages, getChatRecord } from "@/features/backend/chat/db"
import { chatAgent } from "@/features/backend/agent/agent"
import { ChatAgentContext } from "@/features/backend/agent/context"
import { sse } from "@/features/backend/sse"

type RouteParams = {
  params: Promise<{ chatId: string }>
}

/**
 * Accepts a single user prompt, streams runtime events over SSE,
 * and persists appended model messages into the in-memory backend store.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { chatId } = await params

  const chat = getChatRecord(chatId)

  if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 })

  const { prompt }: { prompt?: string } = await request.json()

  if (!prompt || !prompt.trim()) return Response.json({ error: "Prompt is required" }, { status: 400 })
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })

  const context: ChatAgentContext = {
    user: {
      name: "John Doe",
      phone: "1234567890",
    },
  }

  const { stream, memory } = chatAgent.run(prompt, context, {
    // inject the chat history into the memory
    memory: new SimpleMemory(chat.messages),
  })

  return sse(stream, {
    onEnd: async () => {
      appendChatMessages(chatId, await memory.appended())
    },
  })
}
