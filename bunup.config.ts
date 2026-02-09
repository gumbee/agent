import { defineConfig } from "bunup"

export default defineConfig({
  entry: ["src/index.ts", "src/graph.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: false,
  splitting: true,
})
