import { agent, DescribeRegistry } from "@gumbee/agent"
import { observability } from "@gumbee/agent/observability"
import { openai } from "@ai-sdk/openai"
import { searchTool, userBenefitsTool, weatherTool } from "./tools"
import { Symptom, TextWidget, MedicationDetailWidget, MedicationListWidget, SymptomListWidget } from "@/features/widgets"
import { ChatAgentContext } from "./context"

const chatWidgets = new DescribeRegistry()
  .add(Symptom, {
    id: "Symptom",
    description: "A symptom or condition that the user is experiencing.",
    // mark as utility type so the type definition is shared across widgets, but not used as top-level widget type
    utility: true,
  })
  .add(TextWidget, {
    id: "Text",
    description: "Use for normal assistant response text.",
    always: true,
  })
  .add(MedicationDetailWidget, {
    id: "MedicationDetail",
    description: "Detailed medication information with dosage and side effects.",
  })
  .add(MedicationListWidget, {
    id: "MedicationList",
    description: "List of medications with their names and descriptions.",
  })
  .add(SymptomListWidget, {
    id: "SymptomList",
    description: "List of symptom or medication items with short descriptions.",
  })

/**
 * Avoid specifying generics in the agent function itself (e.g don't do `agent<ChatAgentContext>()`) Instead give type hints via parameter annotations and let TypeScript infer the generics (e.g `agent({ system: (context: ChatAgentContext) => ... })`)
 */
export const chatAgent = agent({
  name: "support-agent",
  description: "Helpful assistant that can help with a wide range of tasks",
  system: (context: ChatAgentContext) =>
    `You are a helpful assistant that can help with a wide range of tasks. Keep responses concise, practical, and friendly. Always respond using widgets only and never emit plain text output. When a user asks for personalized guidance, perks, or user-specific actions, call get_user_benefits first. The user's name is ${context.user.name} and their phone number is ${context.user.phone}.`,
  model: openai("gpt-4o-mini"),
  tools: [weatherTool, searchTool, userBenefitsTool],
  widgets: chatWidgets,
  middleware: [observability()],
})
