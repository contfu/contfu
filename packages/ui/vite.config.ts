import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
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
