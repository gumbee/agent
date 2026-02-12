import { defineConfig } from "bunup"

export default defineConfig({
  entry: ["src/index.ts", "src/graph.ts", "src/observability.ts", "src/observability/cli.ts"],
  format: ["esm", "cjs"],
  dts: {
    splitting: true,
  },
  clean: true,
  minify: false,
  splitting: true,
  external: [
    "yjs",
    "y-websocket",
    "y-protocols",
    "lib0",
    "lib0/encoding",
    "lib0/decoding",
    "hono",
    "@hono/node-ws",
    "@hono/node-server",
    "@hono/node-server/serve-static",
  ],
})
