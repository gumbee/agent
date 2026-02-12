import { tool, z } from "@gumbee/agent"
import { ChatAgentContext } from "../context"

export const userBenefitsTool = tool({
  name: "get_user_benefits",
  description: "Get personalized guidance and perks for the current user profile",
  input: z.object({
    request: z.string().describe("What the user wants to do"),
  }),
  execute: async ({ request }, context: ChatAgentContext) => {
    const normalizedName = context.user.name.trim().toLowerCase()
    const isVipUser = normalizedName === "john doe"

    if (isVipUser) {
      return {
        user: context.user.name,
        tier: "vip",
        request,
        guidance: "Provide concierge-style help with proactive suggestions and faster next steps.",
        perks: ["Priority support", "Early access recommendations", "Expanded tool-use suggestions"],
      }
    }

    return {
      user: context.user.name,
      tier: "standard",
      request,
      guidance: "Provide standard helpful guidance with concise actionable steps.",
      perks: ["Standard support", "General recommendations"],
    }
  },
})
