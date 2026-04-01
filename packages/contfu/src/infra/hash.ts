import { createHash } from "node:crypto";

/**
 * Deterministic hash of a plain options object.
 * Keys are sorted to ensure consistent results regardless of insertion order or runtime.
 */
export function hashOpts(opts: Record<string, unknown>): number {
  const json = JSON.stringify(opts, Object.keys(opts).sort());
  const digest = createHash("blake2b512").update(json).digest();
  return Number(digest.readBigInt64LE(0) & 0x7fffffffffffffffn);
}
