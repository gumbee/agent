"use client"

import { useEffect, useRef } from "react"
import { ChatInput } from "@/components/ChatInput"
import { ChatMessage } from "@/components/ChatMessage"
import { useChatStore } from "@/features/chat/store/useChatStore"

export default function Home() {
  const messages = useChatStore((state) => state.messages)
  const streaming = useChatStore((state) => state.streaming)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const reset = useChatStore((state) => state.reset)
  const threadEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, streaming])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto flex h-screen w-full max-w-5xl flex-col overflow-hidden border-x border-gray-200">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-lg text-gray-700">
            <span>Agent Chat</span>
            <span className="text-sm text-gray-400">Example</span>
          </div>
          <button
            type="button"
            onClick={() => void reset()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            New chat
          </button>
        </header>

        <section className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-2">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={threadEndRef} />
          </div>
        </section>

        <footer className="border-t border-gray-200 bg-white px-6 py-4">
          <div className="mx-auto w-full max-w-3xl">
            <ChatInput onSend={sendMessage} disabled={streaming} hasMessages={messages.length > 0} />
          </div>
        </footer>
      </main>
    </div>
  )
}
