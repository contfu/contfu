import Sqids from "sqids";
import { createHmac } from "node:crypto";
import * as v from "valibot";

const BASE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MIN_LENGTH = 6;

export type EntityType =
  | "user"
  | "source"
  | "collection"
  | "consumer"
  | "sourceCollection"
  | "influx";

// Lazy-initialized state
let initialized = false;
let passthrough = false;
let encoders: Map<EntityType, Sqids>;

function init() {
  if (initialized) return;
  initialized = true;

  const secret = process.env.CONTFU_SECRET;
  if (!secret) {
    passthrough = true;
    return;
  }

  passthrough = false;
  encoders = new Map();

  const entities: EntityType[] = [
    "user",
    "source",
    "collection",
    "consumer",
    "sourceCollection",
    "influx",
  ];
  for (const entity of entities) {
    const alphabet = shuffleAlphabet(secret, entity);
    encoders.set(entity, new Sqids({ alphabet, minLength: MIN_LENGTH }));
  }
}

/**
 * Shuffle the base alphabet using HMAC-SHA256 as a seed for Fisher-Yates.
 */
function shuffleAlphabet(secret: string, entity: string): string {
  const hmac = createHmac("sha256", secret).update(entity).digest();
  const chars = BASE_ALPHABET.split("");

  for (let i = chars.length - 1; i > 0; i--) {
    // Use 4 bytes from the HMAC (cycling through) for the random index
    const byteIndex = (chars.length - 1 - i) * 4;
    const seed =
      ((hmac[byteIndex % hmac.length] << 24) |
        (hmac[(byteIndex + 1) % hmac.length] << 16) |
        (hmac[(byteIndex + 2) % hmac.length] << 8) |
        hmac[(byteIndex + 3) % hmac.length]) >>>
      0;
    const j = seed % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

/**
 * Encode a numeric entity ID to an obfuscated string.
 * Returns `String(id)` when CONTFU_SECRET is unset (passthrough mode).
 */
export function encodeId(entity: EntityType, id: number): string {
  init();
  if (passthrough) return String(id);
  return encoders.get(entity)!.encode([id]);
}

/**
 * Decode an obfuscated string back to a numeric entity ID.
 * Returns `null` if the input is invalid or doesn't round-trip.
 * In passthrough mode, parses the string as an integer.
 */
export function decodeId(entity: EntityType, encoded: string): number | null {
  init();
  if (passthrough) {
    const n = Number(encoded);
    return Number.isNaN(n) || !Number.isInteger(n) ? null : n;
  }

  const sqids = encoders.get(entity)!;
  const decoded = sqids.decode(encoded);
  if (decoded.length !== 1) return null;

  const id = decoded[0];
  // Round-trip validation: reject crafted inputs
  if (sqids.encode([id]) !== encoded) return null;

  return id;
}

/**
 * Valibot schema factory: validates a string input and decodes it to a numeric ID.
 * Throws a validation error if decoding fails.
 */
export function idSchema(entity: EntityType): v.GenericSchema<string, number> {
  return v.pipe(
    v.union([v.string(), v.number()]),
    v.transform((val) => (typeof val === "number" ? String(val) : val)),
    v.string(),
    v.transform((encoded): number => {
      const id = decodeId(entity, encoded);
      if (id === null) {
        throw new v.ValiError([
          {
            kind: "validation",
            type: "custom",
            input: encoded,
            expected: "valid encoded ID",
            received: `"${encoded}"`,
            message: "Invalid ID",
            path: undefined,
            issues: undefined,
            lang: undefined,
            abortEarly: undefined,
            abortPipeEarly: undefined,
          } as unknown as v.BaseIssue<unknown>,
        ]);
      }
      return id;
    }),
  ) as unknown as v.GenericSchema<string, number>;
}
