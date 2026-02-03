/** @jsxImportSource @gumbee/prompt */

import { type z, type DescribeRegistry } from "@gumbee/structured"
import { Bold, Code, Group, Heading, Item, Linebreak, List, System, User, type PromptNode } from "@gumbee/prompt"

/**
 * Props for RichWidgetsPrompt component
 */
export type RichWidgetsPromptProps = {
  widgets: DescribeRegistry
}

/**
 * Props for WidgetSchemaResultPrompt component
 */
export type WidgetSchemaResultPromptProps = {
  /** The user's stated intent for the response */
  intent: string
  /** The widget registry */
  registry: DescribeRegistry
  /** The widget IDs to include */
  widgetIds: string[]
}

/**
 * Props for WidgetPickerPrompt component
 */
export type WidgetPickerPromptProps = {
  /** The user's stated intent for the response */
  intent: string
  /** Description of available widgets (id: description format) */
  widgets: { id: string; description?: string }[]
}

/**
 * Generate widget items from the registry for use in a List component.
 */
function RegsitryItems({ registry }: { registry: DescribeRegistry }): PromptNode {
  const items: PromptNode[] = []

  for (const entry of registry.values()) {
    const { meta } = entry
    const names = [meta.id, ...(meta.aliases ?? [])]

    for (const name of names) {
      if (meta.utility) continue

      if (meta.description) {
        items.push(
          <Item>
            <Bold>{name}</Bold>: {meta.description}
          </Item>,
        )
      } else {
        items.push(
          <Item>
            <Bold>{name}</Bold>
          </Item>,
        )
      }
    }
  }

  return items
}

/**
 * Registry array mode instructions
 */
export function RichWidgetsPrompt({ widgets }: RichWidgetsPromptProps): PromptNode {
  return (
    <System>
      <Group tag="rich-widgets">
        <Heading level={2}>Rich Widgets Response System</Heading>
        You MUST create rich, visually engaging responses using UI widgets. <Linebreak repeat={2} />
        <Heading level={3}>Workflow:</Heading>
        <List ordered>
          <Item>
            Call <Code inline>widget_schema</Code> with your intent AFTER completing any other tool calls and before you're ready to respond to the
            user's request. Do NOT respond to the user before calling the <Code inline>widget_schema</Code> tool!
          </Item>
          <Item>
            The <Code inline>widget_schema</Code> tool will provide you with the typescript types for the widgets available to you. You will use these
            types to create a JSON array of widget objects.
          </Item>
          <Item>
            Respond to the user's request with a JSON array of widgets, conforming to the typescript types provided by the{" "}
            <Code inline>widget_schema</Code> tool.
          </Item>
        </List>
        <Linebreak />
        <Heading level={3}>When NOT to use widgets:</Heading>
        <List>
          <Item>Quick, one-sentence answers - respond with plain text directly</Item>
          <Item>
            You've already called widget_schema in this response flow and do not require schemas for other widgets you wish to use and haven't seen
            yet
          </Item>
        </List>
        <Linebreak />
        <Heading level={3}>Important:</Heading>
        After receiving the widget schemas, output a JSON array in your response text wrapped in ```structured code fences. It's important that you
        use the ```structured code fence, not ```json and that you use "structured" as the language identifier.
        <Linebreak />
        Available widgets (id: description)
        <Linebreak />
        <List>
          <RegsitryItems registry={widgets} />
        </List>
      </Group>
    </System>
  )
}

const randomize = <T,>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5)

/**
 * Widget picker prompt - used to select relevant widgets from the registry.
 */
export function WidgetPickerPrompt({ intent, widgets }: WidgetPickerPromptProps): PromptNode {
  return (
    <User>
      Select a set of unique widget IDs needed for a rich, engaging response. Each ID should appear only once - duplicate IDs will be ignored. Order
      does not matter.
      <Linebreak repeat={2} />
      Your stated intent: "{intent}"
      <Linebreak repeat={2} />
      <Heading level={3}>Selection guidelines</Heading>
      <List>
        <Item>Use semantically appropriate widgets: Person for people, Location for places, Recipe for cooking instructions, etc.</Item>
        <Item>Include structural widgets (SectionHeader, List, Text) to organize content</Item>
        <Item>Include Tldr for summaries when the response is comprehensive</Item>
        <Item>Match widget types to the content being described - don't use generic Text when a specialized widget fits better</Item>
        <Item>For simple one-sentence answers, only select Text</Item>
      </List>
      <Linebreak />
      Choose widgets that best represent the information you're about to present. Use specialized widgets where appropriate rather than defaulting to
      generic ones.
      <Linebreak repeat={2} />
      <Heading level={3}>Available widgets (id: description)</Heading>
      <List>
        {widgets.map((widget) => {
          if (widget.description) {
            return (
              <Item>
                {widget.id}: {widget.description}
              </Item>
            )
          } else {
            return <Item>{widget.id}</Item>
          }
        })}
      </List>
      <Linebreak repeat={2} />
      Example response: {`[`}
      {randomize(widgets)
        .slice(0, 3)
        .map((widget) => `"${widget.id}"`)
        .join(", ")}
      {`]`}
      <Linebreak repeat={2} />
      Respond with a set of unique widget IDs to use (no duplicates).
    </User>
  )
}

/**
 * Widget schema result prompt - returned as tool result content.
 * Use with <ToolResult> to wrap as needed.
 */
export function WidgetSchemaResultPrompt({ intent, registry, widgetIds }: WidgetSchemaResultPromptProps): PromptNode {
  // Handle case where no widgets were selected - respond with plain text
  if (widgetIds.length === 0) {
    return <>No specialized widgets needed. Respond to the user's request with plain text directly.</>
  }

  // Get subset registry and schema
  const subsetRegistry = registry.subset(widgetIds)
  const schema = subsetRegistry.toTypescript()

  // Build example using the actual selected widget IDs
  const exampleWidgets = widgetIds.slice(0, 3).map((id) => {
    const entry = registry.get(id)
    // Try to get type from schema's shape.type literal value, fall back to id
    const schemaShape = (entry?.schema as z.ZodObject<z.ZodRawShape> | undefined)?.shape
    const typeField = schemaShape?.type as z.ZodLiteral<string> | undefined
    const type = typeField?.value ?? id

    return `  {"type": "${type}", ...}`
  })
  const exampleJson = `[\n${exampleWidgets.join(",\n")}\n]`

  return (
    <Group tag="widget-schema-result">
      Respond to the user's request with a JSON array of widgets. Use the available widgets creatively to present information in an engaging,
      meaningful way.
      <Linebreak repeat={2} />
      Your stated intent: "{intent}"
      <Linebreak repeat={2} />
      <Heading level={3}>Example response format</Heading>
      <Code lang="structured">{exampleJson}</Code>
      <Linebreak />
      <Heading level={3}>Important</Heading>
      <List>
        <Item>
          Output the JSON array directly in your response text wrapped in <Code inline>```structured</Code> code fences
        </Item>
        <Item>Do NOT call any tools - these type definitions describe JSON objects, not tools</Item>
        <Item>Use widgets to create a rich, engaging response</Item>
        <Item>Match widget types semantically to content (e.g., Person for people, Location for places)</Item>
      </List>
      <Linebreak />
      <Heading level={2}>Available Widget Schemas</Heading>
      <Group tag="schema">{schema}</Group>
      <Linebreak />
      <Group tag="instructions">
        Reply to the user's request based on the available widgets. Do not end the conversation before you've responded to the user's request.
      </Group>
    </Group>
  )
}
