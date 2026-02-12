"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { SuggestionTags } from "./SuggestionTags"

type ChatInputProps = {
  onSend: (prompt: string) => Promise<void>
  disabled?: boolean
  hasMessages?: boolean
}

function useRestoreInputFocus(disabled: boolean) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wasDisabledRef = useRef(disabled)

  useEffect(() => {
    if (wasDisabledRef.current && !disabled) {
      inputRef.current?.focus()
    }
    wasDisabledRef.current = disabled
  }, [disabled])

  const focusIfEnabled = () => {
    if (!inputRef.current?.disabled) {
      inputRef.current?.focus()
    }
  }

  return { inputRef, focusIfEnabled }
}

const inputSuggestions = [
  "what are my user-specific perks?",
  "give me personalized guidance for booking travel",
  "find a cool agent package on the web",
  "what is the weather in Tokyo?",
  "explain the theory of relativity",
  "tell me a joke",
]

export function ChatInput({ onSend, disabled = false, hasMessages = false }: ChatInputProps) {
  const [prompt, setPrompt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { inputRef, focusIfEnabled } = useRestoreInputFocus(disabled)
  const isInputDisabled = disabled || isSubmitting
  const showSuggestions = !hasMessages && !prompt.trim() && !isSubmitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = prompt.trim()
    if (!value || isInputDisabled) return

    setIsSubmitting(true)
    setPrompt("")
    try {
      await onSend(value)
    } finally {
      setIsSubmitting(false)
      focusIfEnabled()
    }
  }

  const handleSuggestionSelect = (suggestion: string) => {
    if (isInputDisabled) return
    setPrompt(suggestion)
    focusIfEnabled()
  }

  return (
    <form onSubmit={handleSubmit} className="relative rounded-2xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
      {showSuggestions ? <SuggestionTags suggestions={inputSuggestions} onSelect={handleSuggestionSelect} disabled={isInputDisabled} /> : null}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Help me find a cool agent package on the web"
          disabled={isInputDisabled}
          className="w-full bg-transparent px-2 py-2 text-gray-900 placeholder:text-gray-400 outline-none disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isInputDisabled || !prompt.trim()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  )
}
