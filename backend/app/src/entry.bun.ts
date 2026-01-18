/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the Bun HTTP server when building for production.
 *
 * Learn more about the Bun integration here:
 * - https://qwik.dev/docs/deployments/bun/
 * - https://bun.sh/docs/api/http
 *
 */
import { createQwikCity } from "@builder.io/qwik-city/middleware/bun";
import qwikCityPlan from "@qwik-city-plan";
import { manifest } from "@qwik-client-manifest";
import render from "./entry.ssr";
import { SyncWorkerManager } from "./lib/server/sync-worker/worker-manager";
import { WebSocketServer } from "./lib/server/websocket/ws-server";

// Create the Qwik City Bun middleware
const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
});

// Initialize sync worker
const syncWorker = new SyncWorkerManager();

// Initialize WebSocket server
const wsServer = new WebSocketServer();
wsServer.setWorker(syncWorker);

// Connect: when items arrive from worker, broadcast to clients
syncWorker.onItems((items, connections) => wsServer.broadcast(items, connections));

// Start the sync worker
await syncWorker.start();

// Allow for dynamic port
const port = Number(Bun.env.PORT ?? 3000);

console.log(`Server started: http://localhost:${port}/`);

const server = Bun.serve({
  async fetch(request: Request, server) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for /ws path
    if (url.pathname === "/ws") {
      if (server.upgrade(request, { data: { id: "" } })) {
        return; // Upgraded to WebSocket
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    const staticResponse = await staticFile(request);
    if (staticResponse) {
      return staticResponse;
    }

    // Server-side render this request with Qwik City
    const qwikCityResponse = await router(request);
    if (qwikCityResponse) {
      return qwikCityResponse;
    }

    // Path not found
    return notFound(request);
  },
  websocket: wsServer.createHandler(),
  port,
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  await syncWorker.stop();
  server.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  await syncWorker.stop();
  server.stop();
  process.exit(0);
});
