import adapter from "@sveltejs/adapter-static"
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte"

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: "../../../dist/observability/dashboard",
      assets: "../../../dist/observability/dashboard",
      fallback: "index.html",
    }),
  },
}

export default config
