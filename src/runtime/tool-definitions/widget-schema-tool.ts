import { z } from "@gumbee/structured"
import { structured } from "../../structured"
import type { DescribeRegistry } from "@gumbee/structured"
import { tool } from "../tool"
import type { LanguageModel, Tool } from "../types"
import { renderToIR, renderToString } from "@gumbee/prompt"
import { RichWidgetsPrompt, WidgetPickerPrompt, WidgetSchemaResultPrompt } from "../../prompts/rich"
import { messagesToString, prompt } from "@gumbee/prompt/ai-sdk"

/**
 * Input schema for the widget schema tool.
 */
const InputSchema = z.object({
  intent: z.string().describe("Describe in one short sentence how you intend to structure your response to the user"),
})

type WidgetSchemaInput = z.infer<typeof InputSchema>
type WidgetSchemaOutput = { instructions: string } | undefined

/**
 * Creates a widget schema tool that picks relevant widgets from a registry.
 *
 * The tool uses a fast model to analyze the conversation and pick the most
 * relevant widgets, then returns their TypeScript schema for the LLM to use.
 */
export function createWidgetSchemaTool(registry: DescribeRegistry, pickerModel: LanguageModel): Tool<any, WidgetSchemaInput, WidgetSchemaOutput> {
  // Extract system prompt from RichWidgetsPrompt
  // We pass empty messages to get just the system part
  // Note: RichWidgetsPrompt returns a Fragment with mapped messages and then a System message.
  // By passing [], we should just get the System message in the IR.
  const ir = renderToIR(RichWidgetsPrompt({ widgets: registry }))
  const systemMsg = ir.find((m) => m.role === "system")
  const systemPrompt = systemMsg ? systemMsg.content : ""

  // Build widget list from registry
  const widgets: { id: string; description?: string }[] = []

  for (const entry of registry.values()) {
    const { meta } = entry
    const names = [meta.id, ...(meta.aliases ?? [])]
    for (const name of names) {
      if (meta.utility) continue
      widgets.push({ id: name, description: meta.description })
    }
  }

  return tool({
    name: "widget_schema",
    description: "Query the UI widget schema before responding. Must be called before returning a response to understand available UI widgets.",
    instructions: systemPrompt,
    input: InputSchema,
    execute: async (input) => {
      const { intent } = input

      const messages = prompt(
        WidgetPickerPrompt({
          intent,
          widgets,
        }),
      )

      // console.log("Widget picker prompt", messagesToString(messages))

      const result = await structured({
        model: pickerModel,
        messages,
        schema: z.array(z.string()),
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        },
      })

      const selectedWidgetIds = (await result.object) as string[]

      // Get unique widget IDs
      const uniqueIds = [...new Set(selectedWidgetIds)]

      return {
        instructions: renderToString(
          WidgetSchemaResultPrompt({
            intent,
            registry,
            widgetIds: uniqueIds,
          }),
        ),
      }
    },
  })
}
