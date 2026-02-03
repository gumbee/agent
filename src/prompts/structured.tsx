/** @jsxImportSource @gumbee/prompt */

/**
 * JSX components for structured output schema instructions
 *
 * These components use the prompt engine's Group and Native components
 * for proper JSX composition.
 */

import { Group, Heading, Item, Linebreak, List, WrapUser } from "@gumbee/prompt"
import type { PromptNode } from "@gumbee/prompt"
import { dynamic, z, unwrapSchema, schemaToTypescript, type DescribeRegistry } from "@gumbee/structured"

/**
 * Props for SchemaInstructions component
 */
export type SchemaInstructionsProps<T> =
  | {
      schema: z.ZodType<T>
      registry?: DescribeRegistry
    }
  | {
      registry: DescribeRegistry
    }

/**
 * Base guidelines for JSON output
 */
function Guidelines(): PromptNode {
  return (
    <>
      <Heading>Guidelines</Heading>
      <List>
        <Item>
          Wrap your JSON output in ```structured code fences. It's important that you use the ```structured code fence, not ```json and that you use
          "structured" as the language identifier.
        </Item>
        <Item>If the schema defines literal/enum values, use them exactly as defined in the schema</Item>
      </List>
    </>
  )
}

/**
 * Registry array mode instructions
 */
function RegistryArrayInstructions<T>(props: SchemaInstructionsProps<T>): PromptNode {
  return (
    <WrapUser>
      Respond with a JSON array. Each element must conform to one of the types defined above—select the most appropriate type for each item based on
      its structure and purpose. {({ hasUser }) => hasUser && "Reply to the user's request which is stated above in the <user> tag."}
      <Linebreak repeat={2} />
      <Group tag="guidelines">
        <Guidelines />
      </Group>
      <Linebreak />
      <Group tag="schema">{schemaToTypescript("schema" in props ? props.schema : dynamic(), props.registry)}</Group>
    </WrapUser>
  )
}

/**
 * Registry object mode instructions
 */
function RegistryObjectInstructions<T>(props: SchemaInstructionsProps<T>): PromptNode {
  return (
    <WrapUser>
      Respond with a JSON object that conforms to one of the types defined above—select the most appropriate type based on the request.{" "}
      {({ hasUser }) => hasUser && "Reply to the user's request which is stated above in the <user> tag."}
      <Linebreak repeat={2} />
      <Group tag="guidelines">
        <Guidelines />
      </Group>
      <Linebreak />
      <Group tag="schema">{schemaToTypescript("schema" in props ? props.schema : dynamic(), props.registry)}</Group>
    </WrapUser>
  )
}

/**
 * Simple schema mode instructions
 */
function SimpleSchemaInstructions<T>(props: SchemaInstructionsProps<T>): PromptNode {
  return (
    <WrapUser>
      Respond with a JSON object conforming to the "Output" schema.{" "}
      {({ hasUser }) => hasUser && "Reply to the user's request which is stated above in the <user> tag."}
      <Linebreak repeat={2} />
      <Group tag="guidelines">
        <Guidelines />
      </Group>
      <Linebreak />
      <Group tag="schema">{schemaToTypescript("schema" in props ? props.schema : dynamic(), props.registry)}</Group>
    </WrapUser>
  )
}

/**
 * Main component that builds structured output instructions
 *
 * @example
 * <SchemaInstructions
 *   schema={z.object({ name: z.string(), age: z.number() })}
 * />
 */
export function SchemaInstructions<T>(props: SchemaInstructionsProps<T>): PromptNode {
  // check if we're generating an object or array
  const mode = "schema" in props ? (unwrapSchema(props.schema) instanceof z.ZodArray ? "array" : "object") : undefined
  const hasRegistry = "registry" in props

  if (hasRegistry) {
    if (mode === "array") {
      return <RegistryArrayInstructions {...props} />
    } else {
      return <RegistryObjectInstructions {...props} />
    }
  } else {
    return <SimpleSchemaInstructions {...props} />
  }
}
