import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 8011,
    host: true,
    fs: {
      // Allow serving files from project root and parent directories
      // This fixes the Vite serving allow list error with bun's node_modules structure
      allow: ["../..", "../../.."],
    },
  },
  ssr: {
    noExternal: process.env.NODE_ENV === "production" ? true : undefined,
    external: [/^@css-inline\//, "@contfu/svc-backend"] as string[],
  },
});
