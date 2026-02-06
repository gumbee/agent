import type { ModelMessage } from "ai"

const DEFAULT_CHARS_PER_TOKEN = 6

const LANGUAGE_RULES = [
  // German
  { pattern: /[äöüßẞ]/i, charsPerToken: 3 },
  // French, Spanish, Portuguese
  { pattern: /[éèêëàâîïôûùüÿçœæáíóúñ]/i, charsPerToken: 3 },
  // Slavic languages (Polish, Czech, etc.)
  { pattern: /[ąćęłńóśźżěščřžýůúďťň]/i, charsPerToken: 3.5 },
] as const

const TOKEN_PATTERN = new RegExp(
  [
    // XML/HTML tags with optional leading whitespace
    `(?:\\s*)?<\\/?[a-zA-Z][\\w-]*>`,
    // Markdown headers
    `(?:\\s*)?#{1,6}\\s+`,
    // Markdown lists
    `(?:\\s*)?[-*]\\s+`,
    // Code block markers
    `(?:\\s*)?\`\`\``,
    // CJK characters (Chinese, Japanese, Korean)
    `(?:\\s*)?[\\u4E00-\\u9FFF\\u3400-\\u4DBF\\u3000-\\u303F\\uFF00-\\uFFEF\\u30A0-\\u30FF\\u2E80-\\u2EFF\\u31C0-\\u31EF\\u3200-\\u32FF\\u3300-\\u33FF\\uAC00-\\uD7AF\\u1100-\\u11FF\\u3130-\\u318F\\uA960-\\uA97F\\uD7B0-\\uD7FF]`,
    // Alphanumeric words
    `(?:\\s*)?[a-zA-Z0-9\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF]+`,
    // Numbers with optional decimals
    `(?:\\s*)?\\d+(?:[.,]\\d+)*`,
    // Punctuation sequences
    `(?:\\s*)?[.,!?;(){}[\\]<>:/\\\\|@#$%^&*+=\`~_-]+`,
    // Remaining whitespace
    `\\s+`,
  ].join("|"),
  "gu",
)

const CJK_PATTERN =
  /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF\u30A0-\u30FF\u2E80-\u2EFF\u31C0-\u31EF\u3200-\u32FF\u3300-\u33FF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/

/**
 * Estimates the number of tokens in a text string using heuristic rules.
 */
export function estimateTokenCount(text?: string): number {
  if (!text) return 0

  const segments = text.match(TOKEN_PATTERN) ?? []
  let count = 0

  for (const segment of segments) {
    count += estimateSegment(segment)
  }

  return count
}

/**
 * Estimates the number of tokens in an AI SDK ModelMessage string using heuristic rules.
 */
export function estimateMessageTokens(message: ModelMessage): number {
  if (typeof message.content === "string") {
    return estimateTokenCount(message.content)
  }

  let count = 0
  for (const part of message.content) {
    switch (part.type) {
      case "text":
      case "reasoning":
        count += estimateTokenCount(part.text)
        break
      case "tool-call":
        count += estimateTokenCount(part.toolName)
        count += estimateTokenCount(JSON.stringify(part.input))
        break
      case "tool-result": {
        const output = part.output
        if (!output) break

        // Safer to switch on type
        switch (output.type) {
          case "text":
          case "error-text":
            count += estimateTokenCount(output.value)
            break
          case "json":
          case "error-json":
            count += estimateTokenCount(JSON.stringify(output.value))
            break
          case "execution-denied":
            if (output.reason) count += estimateTokenCount(output.reason)
            break
          case "content":
            for (const item of output.value) {
              if (item.type === "text") {
                count += estimateTokenCount(item.text)
              } else {
                count += 85 + 170 * 4 // assume 2*512px per axis and gpt 4o token overhead
              }
            }
            break
        }
        break
      }
      case "image":
      case "file":
        count += 85 + 170 * 4 // assume 2*512px per axis and gpt 4o token overhead
        break
      default:
        // Other parts (like image-data, file-data if they appear here)
        // If it has 'text' property, count it?
        // For now, assume binary/other overhead
        count += 85 + 170 * 4 // assume 2*512px per axis and gpt 4o token overhead
    }
  }
  return count
}

function estimateSegment(segment: string): number {
  const trimmed = segment.trim()

  if (!trimmed) {
    return segment.includes("\n") ? 1 : 0
  }

  // XML/HTML tags
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return Math.max(1, Math.ceil(trimmed.length / 4))
  }

  // CJK characters - each character is roughly one token
  if (CJK_PATTERN.test(trimmed)) {
    return Array.from(trimmed).length
  }

  // Numbers
  if (/^\d+(?:[.,]\d+)*$/.test(trimmed)) {
    return 1
  }

  // Punctuation
  if (/^[.,!?;(){}[\]<>:/\\|@#$%^&*+=`~_-]+$/.test(trimmed)) {
    return trimmed.length > 1 ? Math.ceil(trimmed.length / 2) : 1
  }

  // Alphanumeric words
  if (/^[a-zA-Z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]+$/.test(trimmed)) {
    if (segment.length <= 3) return 1
    const charsPerToken = getLanguageCharsPerToken(trimmed)
    return Math.ceil(segment.length / charsPerToken)
  }

  return Math.ceil(trimmed.length / DEFAULT_CHARS_PER_TOKEN)
}

function getLanguageCharsPerToken(text: string): number {
  for (const rule of LANGUAGE_RULES) {
    if (rule.pattern.test(text)) {
      return rule.charsPerToken
    }
  }
  return DEFAULT_CHARS_PER_TOKEN
}
