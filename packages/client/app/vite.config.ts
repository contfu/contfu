import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 5173,
  },
  preview: {
    port: 5173,
    host: true,
  },
  ssr: {
    noExternal: process.env.NODE_ENV === "production" ? true : undefined,
    external: ["sharp", "@contfu/media-optimizer"],
  },
});
