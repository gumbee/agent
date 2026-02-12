import { agent } from "@gumbee/agent"
import { observability } from "@gumbee/agent/observability"
import { openai } from "@ai-sdk/openai"
import { searchTool, userBenefitsTool, weatherTool } from "./tools"
import { ChatAgentContext } from "./context"

/**
 * Avoid specifying generics in the agent function itself (e.g don't do `agent<ChatAgentContext>()`) Instead give type hints via parameter annotations and let TypeScript infer the generics (e.g `agent({ system: (context: ChatAgentContext) => ... })`)
 */
export const chatAgent = agent({
  name: "support-agent",
  description: "Helpful assistant that can help with a wide range of tasks",
  system: (context: ChatAgentContext) =>
    `You are a helpful assistant that can help with a wide range of tasks. Keep responses concise, practical, and friendly. Use tools when useful. When a user asks for personalized guidance, perks, or user-specific actions, call get_user_benefits first. The user's name is ${context.user.name} and their phone number is ${context.user.phone}.`,
  model: openai("gpt-4o-mini"),
  tools: [weatherTool, searchTool, userBenefitsTool],
  middleware: [observability()],
})
