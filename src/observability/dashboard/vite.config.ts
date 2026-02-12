import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

const agentRoot = path.resolve(__dirname, "../../..")

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
  resolve: {
    alias: {
      "@gumbee/agent/graph": path.resolve(agentRoot, "src/graph.ts"),
      "@gumbee/agent/observability": path.resolve(agentRoot, "src/observability.ts"),
    },
  },
  worker: {
    format: "es",
  },
  server: {
    proxy: {
      "/api": "http://localhost:4500",
      "/api/yjs": {
        target: "ws://localhost:4500",
        ws: true,
      },
    },
  },
})
