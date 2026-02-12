import type { UiMessage } from "@/features/chat/types"

type ChatMessageProps = {
  message: UiMessage
}

function ToolStatus({ status }: { status: "running" | "completed" | "error" }) {
  if (status === "running") return <span className="inline-block size-2 rounded-full bg-gray-400 animate-throb" />
  if (status === "completed") return <span className="inline-block size-2 rounded-full bg-emerald-500" />
  return <span className="inline-block size-2 rounded-full bg-rose-500" />
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end my-4 first:mt-0">
        <div className="max-w-[80%] rounded-2xl bg-sky-100 px-4 py-2 text-gray-900 leading-relaxed">{message.content}</div>
      </div>
    )
  }

  return (
    <div className="my-4 first:mt-0">
      <div className="max-w-[85%] text-gray-900 leading-relaxed space-y-3">
        {message.parts.length === 0 && message.streaming && <span className="inline-block size-3 rounded-full bg-gray-500 animate-throb" />}
        {message.parts.map((part, index, parts) => {
          const isLatestPart = index === parts.length - 1

          if (part.type === "text") {
            return (
              <p key={`${message.id}-text-${index}`} className="whitespace-pre-wrap">
                {part.text}
                {message.streaming && isLatestPart && <span className="inline-block size-3 rounded-full bg-gray-500 animate-throb ml-[4px]" />}
              </p>
            )
          }

          return (
            <div
              key={`${message.id}-tool-${part.toolCallId}`}
              className="flex place-self-start items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
            >
              <ToolStatus status={part.status} />
              <span>{part.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
