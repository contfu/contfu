import { createHash } from "node:crypto";

/**
 * Deterministic hash of a JSON-like object.
 * Keys are sorted recursively to ensure consistent results regardless of insertion order or runtime.
 */
export function hashObject(opts: Record<string, unknown>): number {
  const json = JSON.stringify(sortObject(opts));
  const digest = createHash("blake2b512").update(json).digest();
  return Number(digest.readBigInt64LE(0) & 0x7fffffffffffffffn);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortObject(entryValue)]),
    );
  }
  return value;
}
