/**
 * WebSocket handler module for svelte-adapter-bun.
 *
 * This module exports the WebSocket handler configuration that will be
 * re-exported from hooks.server.ts for svelte-adapter-bun to pick up.
 * The handler is created from the WebSocketServer singleton defined in
 * the startup module.
 *
 * Usage in hooks.server.ts:
 *   export { websocket } from "./websocket";
 *
 * @see https://github.com/gornostay25/svelte-adapter-bun#websocket-support
 */
import { getWebSocketHandler } from "$lib/server/startup";

/**
 * WebSocket handler configuration for Bun.serve().
 * Contains open, message, and close callbacks from WebSocketServer.
 */
export const websocket = getWebSocketHandler();
