export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export type ModelPricingFn = (usage: TokenUsage) => number

const createSimplePricing = (inputPerMillion: number, outputPerMillion: number, cacheReadPerMillion: number): ModelPricingFn => {
  return (usage: TokenUsage) => {
    const inputCost = (usage.inputTokens / 1_000_000) * inputPerMillion
    const outputCost = (usage.outputTokens / 1_000_000) * outputPerMillion
    let totalCost = inputCost + outputCost

    if (usage.cacheReadTokens && usage.cacheReadTokens > 0) {
      // Deduct standard input cost and add cache read cost for cached tokens
      totalCost -= (usage.cacheReadTokens / 1_000_000) * inputPerMillion
      totalCost += (usage.cacheReadTokens / 1_000_000) * cacheReadPerMillion
    }

    return totalCost
  }
}

// Pricing definitions based on Jan 2026 data
const PRICING: Record<string, Record<string, ModelPricingFn>> = {
  "openai.responses": {
    "gpt-5.1": createSimplePricing(1.25, 10.0, 0.125),
    "gpt-5.1-mini": createSimplePricing(0.3, 2.5, 0.03),
    "gpt-5.2": createSimplePricing(1.75, 14.0, 0.175),
    "gpt-5.1-codex-mini": createSimplePricing(0.25, 2, 0.025),
    "gpt-5.1-codex": createSimplePricing(0.5, 4, 0.05),
    "gpt-5-mini": createSimplePricing(0.25, 2, 0.025),
  },
  anthropic: {
    "claude-4-5-sonnet": createSimplePricing(3.0, 15.0, 0.3),
    "claude-4-5-opus": createSimplePricing(5.0, 25.0, 0.5),
  },
  "google.generative-ai": {
    "gemini-2.5-pro": createSimplePricing(1.25, 10.0, 0.125),
    "gemini-2.5-flash": createSimplePricing(0.3, 1.2, 0.03),
    "gemini-3-pro": createSimplePricing(2.0, 12.0, 0.2),
    "gemini-3-flash": createSimplePricing(0.5, 3.0, 0.05),
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
