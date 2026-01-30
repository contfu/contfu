import type { Handle } from "@sveltejs/kit";
import { startSyncConnection } from "$lib/sync.js";

// Start the sync connection when the server starts
// Use .catch() to handle any errors from the async function
startSyncConnection().catch((error) => {
  console.error("[HOOKS] Failed to start sync connection:", error);
});

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
