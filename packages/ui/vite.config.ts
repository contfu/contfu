import { sveltekit, type Config as SvelteKitConfig } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import adapter from "svelte-adapter-bun";
import { defineConfig } from "vite";

const svelteKitConfig = {
  preprocess: vitePreprocess(),
  adapter: adapter(),
  alias: {
    "$lib/*": "./src/lib/*",
  },
  experimental: {
    remoteFunctions: true,
  },
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
} satisfies SvelteKitConfig;

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(svelteKitConfig)],
  server: {
    port: 8013,
    host: true,
    allowedHosts: ["x7"],
  },
  preview: {
    port: 8013,
    host: true,
    allowedHosts: ["x7"],
  },
  ssr: {
    noExternal: process.env.NODE_ENV === "production" ? true : undefined,
  },
});
