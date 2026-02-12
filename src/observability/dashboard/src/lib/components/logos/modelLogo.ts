export type ModelProviderIcon = "anthropic" | "google" | "openai" | "grok" | "other"

function normalize(value?: string): string {
  return value?.trim().toLowerCase() ?? ""
}

export function getModelProviderIcon(provider?: string, modelId?: string): ModelProviderIcon {
  const normalizedProvider = normalize(provider)

  if (normalizedProvider.startsWith("anthropic")) return "anthropic"
  if (normalizedProvider.startsWith("google")) return "google"
  if (normalizedProvider.startsWith("openai")) return "openai"
  if (normalizedProvider.startsWith("grok")) return "grok"

  const normalizedModelId = normalize(modelId)
  if (!normalizedModelId) return "other"

  if (normalizedModelId.includes("claude")) return "anthropic"
  if (normalizedModelId.includes("gemini")) return "google"
  if (normalizedModelId.includes("grok")) return "grok"

  if (
    normalizedModelId.startsWith("gpt") ||
    normalizedModelId.startsWith("o1") ||
    normalizedModelId.startsWith("o3") ||
    normalizedModelId.startsWith("o4")
  ) {
    return "openai"
  }

  return "other"
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function providerColor(provider: string): string {
  const hue = hashString(provider) % 360
  return `hsl(${hue} 62% 48%)`
}

export function providerInitial(provider: string): string {
  const char = provider.match(/[a-zA-Z0-9]/)?.[0]
  return char ? char.toUpperCase() : "?"
}
