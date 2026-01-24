import type { Handle } from "@sveltejs/kit";
import { startSyncConnection } from "$lib/sync.js";

// Start the sync connection when the server starts
startSyncConnection();

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event);
};
