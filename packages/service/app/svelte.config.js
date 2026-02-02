import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "svelte-adapter-bun";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      external: [
        "@css-inline/css-inline",
        "@css-inline/css-inline-darwin-arm64",
        "@contfu/svc-backend",
      ],
    }),
    alias: {
      "$lib/*": "./src/lib/*",
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
