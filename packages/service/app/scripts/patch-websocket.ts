/**
 * Fix svelte-adapter-bun WebSocket support after rolldown code-splitting.
 *
 * The adapter patches build/server/index.js to wire up the `websocket` export
 * from hooks.server.ts. However, rolldown splits `get_hooks()` into a separate
 * chunk (chunks/internal-*.js), so two of the four regex patches miss their
 * target. This script applies the missing patches to the chunk file.
 *
 * Specifically, it adds `websocket` to the destructuring of the hooks import
 * and to the return value of `get_hooks()`.
 */
import { readdirSync } from "node:fs";

const chunksDir = new URL("../build/server/chunks/", import.meta.url).pathname;
const internalChunk = readdirSync(chunksDir).find(
  (f) => f.startsWith("internal-") && f.endsWith(".js"),
);

if (!internalChunk) {
  console.error("patch-websocket: could not find internal chunk");
  process.exit(1);
}

const chunkPath = `${chunksDir}${internalChunk}`;
let code = await Bun.file(chunkPath).text();

const original = code;

// Add `let websocket;` after `async function get_hooks() {`
code = code.replace(/(async function get_hooks\(\) {)/, "$1\n\tlet websocket;");

// Add `websocket,` to the destructuring assignment from the hooks import
code = code.replace(/(\({handle,)/, "$1websocket,");

// Add `websocket,` to the return object
code = code.replace(/(return {\s*handle,)/, "$1\n\t\twebsocket,");

if (code === original) {
  console.warn("patch-websocket: no changes made — patterns may have changed");
} else {
  await Bun.write(chunkPath, code);
  console.log(`patch-websocket: patched ${internalChunk}`);
}
