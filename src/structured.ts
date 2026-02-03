export { z } from "@gumbee/structured"
import { prompt } from "@gumbee/prompt/ai-sdk"
import { type z, type StructuredResult, type StructuredSchemaOptions } from "@gumbee/structured"
import { wrapAsyncIterable } from "./utils/structured-transform"
import { streamText, type ModelMessage } from "ai"
import { SchemaInstructions, type SchemaInstructionsProps } from "./prompts/structured.tsx"

export type AiSdkStructuredOptions<T> = StructuredSchemaOptions<T> &
  Parameters<typeof streamText>[0] & {
    /** Callback invoked with any text that appears before the JSON content */
    onPreamble?: (text: string) => void
  }

/**
 * Stream a structured JSON object from a language model using schema-aware progressive parsing.
 *
 * This function wraps the ai-sdk's `streamText` and pipes the output through the `StructuredJson`
 * parser, providing real-time partial object updates as the model generates JSON.
 *
 * @param options - Configuration options combining structured parsing options with ai-sdk's streamText options
 * @param options.schema - Zod schema defining the expected output structure
 * @param options.registry - Optional registry for dynamic schema resolution
 * @param options.onPreamble - Callback invoked with any text that appears before the JSON content
 * @param options.model - The language model to use (passed to streamText)
 * @param options.messages - Existing messages to include in the conversation
 * @param options.prompt - Simple prompt string (alternative to messages)
 *
 * @returns A StructuredResult with partials, object, and usage
 *
 * @example
 * ```ts
 * const result = structured({
 *   model: openai("gpt-4o"),
 *   schema: z.object({ name: z.string(), age: z.number() }),
 *   prompt: "Generate a person",
 *   onPreamble: (text) => console.log("Preamble:", text),
 * })
 *
 * // Stream partial objects as they build
 * for await (const partial of result.partials) {
 *   console.log(partial) // { name: "Jo" }, { name: "John" }, { name: "John", age: 30 }
 * }
 *
 * // Or await the final object
 * const person = await result.object
 * const usage = await result.usage
 * ```
 */
export function structured<T>(options: AiSdkStructuredOptions<T>): StructuredResult<T, ReturnType<typeof streamText>> {
  const { messages: inMessages, prompt: inPrompt, onPreamble, ...rest } = options

  const existingMessages: ModelMessage[] | undefined =
    typeof inPrompt === "string" ? [{ role: "user", content: inPrompt }] : ((inMessages ?? inPrompt) as ModelMessage[])

  const schema = "schema" in options ? (options.schema as z.ZodType<T>) : undefined
  const registry = "registry" in options ? options.registry : undefined

  // Remove schema options from rest to avoid passing them to ai-sdk
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schema: _, registry: __, ...aiSdkParams } = rest as typeof rest & { schema?: unknown; registry?: unknown }

  // Build schema instruction props
  const schemaProps: SchemaInstructionsProps<T> = schema ? { schema, registry } : { registry: registry! }

  const messages = prompt(SchemaInstructions(schemaProps), { messages: existingMessages })

  const result = streamText({
    ...aiSdkParams,
    prompt: undefined,
    messages,
  })

  // Wrap the text stream with structured parsing
  // ReadableStream implements AsyncIterable in modern environments
  const { partials, object, text } = wrapAsyncIterable<T>(() => result.textStream, {
    schema,
    registry,
    onPreamble,
    provider: "ai-sdk",
  })

  return {
    partials,
    object,
    text,
    raw: result,
  }
}
