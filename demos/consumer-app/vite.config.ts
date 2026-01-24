import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 4000,
  },
  ssr: {
    noExternal: process.env.NODE_ENV === "production" ? true : undefined,
  },
});
