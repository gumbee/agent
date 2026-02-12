import { sveltekit } from "@sveltejs/kit/vite"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
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
