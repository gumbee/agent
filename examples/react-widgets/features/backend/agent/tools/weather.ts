import { tool, z } from "@gumbee/agent"

export const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a city",
  input: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    await new Promise((resolve) => setTimeout(resolve, 2500))

    return {
      city,
      temperatureC: 22,
      conditions: "Sunny",
    }
  },
})
