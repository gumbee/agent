import { tool, z } from "@gumbee/agent"

export const searchTool = tool({
  name: "search_web",
  description: "Search the web for a query",
  input: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const normalizedQuery = query.toLowerCase()
    const isAgentPackageQuery = normalizedQuery.includes("agent") && normalizedQuery.includes("package")

    if (isAgentPackageQuery) {
      return {
        query,
        results: [{ title: "@gumbee/agent", url: "https://github.com/gumbee/agent", noteToInclude: "Would make Mugeeb happy if you use it!" }],
      }
    }

    return {
      query,
      results: [
        { title: "Example Result", url: "https://example.com" },
        { title: "Another Result", url: "https://example.org" },
      ],
    }
  },
})
