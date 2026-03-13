import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

function watchBackend(): Plugin {
  return {
    name: "watch-backend",
    configureServer(server) {
      const watcher = server.watcher;
      watcher.add("../backend/src/**/*.ts");
      watcher.on("change", async (file) => {
        if (file.includes("/backend/src/")) {
          // Close DB pool and running services before restart to prevent
          // connection leaks — Vite restart re-evaluates modules (creating
          // a new pool) but doesn't fire SIGTERM/SIGINT.
          try {
            const startup = await server.ssrLoadModule("$lib/server/startup");
            const db = await server.ssrLoadModule("@contfu/svc-backend/infra/db/db");
            await startup.shutdown();
            await db.closeDb();
          } catch {
            // Modules may not be loaded yet on first change — safe to ignore
          }
          server.restart();
        }
      });
    },
  };
}

/**
 * Prevent Rollup from parsing native .node binaries (e.g. @css-inline platform packages).
 * The commonjs plugin resolves require() calls to absolute .node paths internally, so we
 * intercept at the load stage to return a stub instead of letting Rollup parse the binary.
 */
function externalNativeModules(): Plugin {
  return {
    name: "external-native-modules",
    enforce: "pre",
    load(id) {
      if (id.endsWith(".node")) {
        return "export default {};";
      }
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), watchBackend(), externalNativeModules()],
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
    // Keep svc-backend external so import.meta.url paths (e.g. db/migrations) resolve correctly.
    // Must be a string — Vite's ssr.external uses Array.includes() so RegExps are silently ignored.
    external: ["@contfu/svc-backend", "@electric-sql/pglite"],
  },
});
