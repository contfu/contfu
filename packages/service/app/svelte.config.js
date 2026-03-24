import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "svelte-adapter-bun";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  vitePlugin: { inspector: true },
  kit: {
    adapter: adapter({
      external: ["@css-inline/css-inline"],
    }),
    alias: {
      "$lib/*": "./src/lib/*",
    },
    prerender: {
      entries: [],
    },
    experimental: {
      remoteFunctions: true,
    },
  },
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
};

export default config;
