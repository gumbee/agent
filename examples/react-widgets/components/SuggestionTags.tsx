"use client"

type SuggestionTagsProps = {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  disabled?: boolean
}

function getSuggestionTransform(index: number, total: number) {
  const startAngle = -160
  const endAngle = -20
  const angleStep = total > 1 ? (endAngle - startAngle) / (total - 1) : 0
  const currentAngle = total > 1 ? startAngle + index * angleStep : -90

  const radiusX = 360
  const radiusY = 160
  const rad = currentAngle * (Math.PI / 180)

  const x = Math.cos(rad) * radiusX
  let y = Math.sin(rad) * radiusY - 13

  if (index === 1) {
    y += 13
  } else if (index === 3) {
    y += 27
  } else if (index === 4) {
    y += 21
  }

  const seed = index * 1330
  const random = (Math.sin(seed) * 43758.5453) % 1
  const rotation = (random - 0.5) * 9

  return `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotation}deg)`
}

export function SuggestionTags({ suggestions, onSelect, disabled = false }: SuggestionTagsProps) {
  if (!suggestions.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion}
          className="pointer-events-auto absolute left-1/2 top-1/2 transition-all duration-300"
          style={{
            transform: getSuggestionTransform(index, suggestions.length),
            transitionDelay: `${index * 45}ms`,
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="whitespace-nowrap rounded-full border border-gray-300 bg-white/95 px-3 py-1.5 text-xs text-gray-700 shadow-sm transition hover:scale-105 hover:bg-white hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        </div>
      ))}
    </div>
  )
}
