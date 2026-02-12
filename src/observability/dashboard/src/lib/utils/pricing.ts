export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export type ModelPricingFn = (usage: TokenUsage) => number

const createSimplePricing = (
  inputPerMillion: number,
  outputPerMillion: number,
  cacheReadPerMillion: number,
  cacheWritePerMillion = 0,
): ModelPricingFn => {
  return (usage: TokenUsage) => {
    const inputCost = (usage.inputTokens / 1_000_000) * inputPerMillion
    const outputCost = (usage.outputTokens / 1_000_000) * outputPerMillion
    let totalCost = inputCost + outputCost

    if (usage.cacheReadTokens && usage.cacheReadTokens > 0) {
      // Deduct standard input cost and add cache read cost for cached tokens
      totalCost -= (usage.cacheReadTokens / 1_000_000) * inputPerMillion
      totalCost += (usage.cacheReadTokens / 1_000_000) * cacheReadPerMillion
    }

    if (usage.cacheWriteTokens && usage.cacheWriteTokens > 0) {
      totalCost += (usage.cacheWriteTokens / 1_000_000) * cacheWritePerMillion
    }

    return totalCost
  }
}

const createTieredPricing = (
  inputPerMillionUnder200k: number,
  outputPerMillionUnder200k: number,
  cacheReadPerMillionUnder200k: number,
  inputPerMillionOver200k: number,
  outputPerMillionOver200k: number,
  cacheReadPerMillionOver200k: number,
): ModelPricingFn => {
  return (usage: TokenUsage) => {
    const over200k = usage.inputTokens > 200_000
    const inputPerMillion = over200k ? inputPerMillionOver200k : inputPerMillionUnder200k
    const outputPerMillion = over200k ? outputPerMillionOver200k : outputPerMillionUnder200k
    const cacheReadPerMillion = over200k ? cacheReadPerMillionOver200k : cacheReadPerMillionUnder200k
    return createSimplePricing(inputPerMillion, outputPerMillion, cacheReadPerMillion)(usage)
  }
}

// Pricing definitions based on Jan 2026 data
const PRICING: Record<string, Record<string, ModelPricingFn>> = {
  "openai.responses": {
    "gpt-5.2": createSimplePricing(1.75, 14.0, 0.175),
    "gpt-5.1": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5-mini": createSimplePricing(0.25, 2.0, 0.025),
    "gpt-5-nano": createSimplePricing(0.05, 0.4, 0.005),
    "gpt-5.2-chat-latest": createSimplePricing(1.75, 14.0, 0.175),
    "gpt-5.1-chat-latest": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5-chat-latest": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5.1-codex-max": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5.1-codex": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5-codex": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5.2-pro": createSimplePricing(21.0, 168.0, 0),
    "gpt-5-pro": createSimplePricing(15.0, 120.0, 0),
    "gpt-4.1": createSimplePricing(2.0, 8.0, 0.5),
    "gpt-4.1-mini": createSimplePricing(0.4, 1.6, 0.1),
    "gpt-4.1-nano": createSimplePricing(0.1, 0.4, 0.025),
    "gpt-4o": createSimplePricing(2.5, 10.0, 1.25),
    "gpt-4o-2024-05-13": createSimplePricing(5.0, 15.0, 0),
    "gpt-4o-mini": createSimplePricing(0.15, 0.6, 0.075),
    "gpt-4o-audio-preview": createSimplePricing(2.5, 10.0, 0),
    o1: createSimplePricing(15.0, 60.0, 7.5),
    o3: createSimplePricing(2.0, 8.0, 0.5),
    "o3-deep-research": createSimplePricing(10.0, 40.0, 2.5),
    "o4-mini": createSimplePricing(1.1, 4.4, 0.275),
    "o4-mini-deep-research": createSimplePricing(2.0, 8.0, 0.5),
    "o3-mini": createSimplePricing(1.1, 4.4, 0.55),
    "gpt-5.1-codex-mini": createSimplePricing(0.25, 2, 0.025),
    "codex-mini-latest": createSimplePricing(1.5, 6.0, 0.375),
    "gpt-4o-mini-search-preview": createSimplePricing(0.15, 0.6, 0),
    "gpt-4o-search-preview": createSimplePricing(2.5, 10.0, 0),
    "computer-use-preview": createSimplePricing(3.0, 12.0, 0),
    "gpt-image-1.5": createSimplePricing(5.0, 10.0, 1.25),
    "gpt-image-1": createSimplePricing(5.0, 0, 1.25),
    "gpt-image-1-mini": createSimplePricing(2.0, 0, 0.2),
  },
  anthropic: {
    "claude-opus-4-6": createSimplePricing(5.0, 25.0, 0.5, 6.25),
    "claude-opus-4-5": createSimplePricing(5.0, 25.0, 0.5, 6.25),
    "claude-opus-4-1": createSimplePricing(15.0, 75.0, 1.5, 18.75),
    "claude-opus-4-0": createSimplePricing(15.0, 75.0, 1.5, 18.75),
    "claude-sonnet-4-5": createSimplePricing(3.0, 15.0, 0.3, 3.75),
    "claude-sonnet-4-0": createSimplePricing(3.0, 15.0, 0.3, 3.75),
    "claude-3-7-sonnet-latest": createSimplePricing(3.0, 15.0, 0.3, 3.75),
    "claude-haiku-4-5": createSimplePricing(1.0, 5.0, 0.1, 1.25),
    "claude-3-5-haiku-latest": createSimplePricing(0.8, 4.0, 0.08, 1.0),
    "claude-3-haiku-20240307": createSimplePricing(0.25, 1.25, 0.03, 0.3),
  },
  "google.generative-ai": {
    "gemini-3-pro-preview": createTieredPricing(2.0, 12.0, 0.2, 4.0, 18.0, 0.4),
    "gemini-3-flash-preview": createSimplePricing(0.5, 3.0, 0.05),
    "gemini-3-pro-image-preview": createSimplePricing(2.0, 12.0, 0),
    "gemini-2.5-pro": createTieredPricing(1.25, 10.0, 0.125, 2.5, 15.0, 0.25),
    "gemini-2.5-flash": createSimplePricing(0.3, 2.5, 0.03),
    "gemini-2.5-flash-preview-09-2025": createSimplePricing(0.3, 2.5, 0.03),
    "gemini-2.5-flash-lite": createSimplePricing(0.1, 0.4, 0.01),
    "gemini-2.5-flash-lite-preview-09-2025": createSimplePricing(0.1, 0.4, 0.01),
    "gemini-2.0-flash": createSimplePricing(0.1, 0.4, 0.025),
  },
  "xai.chat": {
    "grok-code-fast-1": createSimplePricing(0.2, 1.5, 0.02),
    "grok-4-1-fast-non-reasoning": createSimplePricing(0.2, 0.5, 0.05),
    "grok-4-1-fast-reasoning": createSimplePricing(0.2, 0.5, 0.05),
    "grok-4-fast-non-reasoning": createSimplePricing(0.2, 0.5, 0.05),
    "grok-4-fast-reasoning": createSimplePricing(0.2, 0.5, 0.05),
    "grok-4-0709": createSimplePricing(3, 15, 0.75),
  },
}

// Normalization map for provider names that might come in different formats
const PROVIDER_ALIASES: Record<string, string> = {
  "anthropic.messages": "anthropic",
  vertex: "google.generative-ai",
  bedrock: "anthropic",
}

function resolveProvider(providerId: string): string {
  return PROVIDER_ALIASES[providerId] ?? providerId
}

/**
 * Calculate the cost for a given model and usage.
 * Returns null if the model/provider combination is unknown.
 */
export function calculateCost(providerId: string | undefined, modelId: string | undefined, usage: TokenUsage | undefined): number | null {
  if (!providerId || !modelId || !usage) return null

  const resolved = resolveProvider(providerId)
  const providerPricing = PRICING[resolved]
  if (!providerPricing) return null

  // Try exact match first, then prefix match (e.g. "gpt-5.1-2025-04-14" -> "gpt-5.1")
  const pricingFn = providerPricing[modelId] ?? Object.entries(providerPricing).find(([key]) => modelId.startsWith(key))?.[1]
  if (!pricingFn) return null

  return pricingFn(usage)
}

/**
 * Recursively compute total cost across all agent nodes in a subtree.
 */
export function calculateTreeCost(node: { type: string; children: any[]; provider?: string; modelId?: string; usage?: TokenUsage }): number {
  let total = 0

  if (node.type === "agent" && node.usage) {
    total += calculateCost(node.provider, node.modelId, node.usage) ?? 0
  }

  if (node.children) {
    for (const child of node.children) {
      total += calculateTreeCost(child)
    }
  }

  return total
}

/**
 * Format a cost value as a dollar string.
 * - Less than $0.01: shows 4 decimal places (e.g. "$0.0012")
 * - Less than $1.00: shows 3 decimal places (e.g. "$0.123")
 * - Otherwise: shows 2 decimal places (e.g. "$1.23")
 */
export function formatCost(cost: number | null): string {
  if (cost === null) return "-"
  if (cost === 0) return "$0.00"
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}
