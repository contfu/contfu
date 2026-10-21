const PREFIX = "1:";

type RefDimensions = { connection?: string; scope?: string; collection?: string };
/** Versioned transport identity. Keys are bytes, not UTF-8 strings. */
export type ScopedRef = RefDimensions & { key: Buffer };

type WireRef = RefDimensions & { key: string };

function encodeWireRef(ref: WireRef): string {
  for (const value of [ref.connection, ref.scope, ref.collection]) {
    if (value !== undefined && (typeof value !== "string" || !value.length))
      throw new TypeError("Scoped reference dimensions must be non-empty strings");
  }
  return (
    PREFIX +
    [ref.connection, ref.scope, ref.collection, ref.key]
      .map((value) => (value === undefined ? "" : encodeURIComponent(value)))
      .join(":")
  );
}

export function encodeScopedRef(ref: ScopedRef): Buffer {
  return Buffer.from(encodeWireRef({ ...ref, key: ref.key.toString("base64url") }));
}

function decodeWireRef(text: string): WireRef | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const fields = text.slice(PREFIX.length).split(":");
    if (fields.length !== 4) return null;
    const [connection, scope, collection, key] = fields.map(decodeURIComponent);
    if (key === undefined || !/^[A-Za-z0-9_-]*$/.test(key) || key.length % 4 === 1) return null;
    const ref: WireRef = {
      ...(connection ? { connection } : {}),
      ...(scope ? { scope } : {}),
      ...(collection ? { collection } : {}),
      key,
    };
    // Accept only the canonical encoding, including escaped delimiters and UTF-8.
    return encodeWireRef(ref) === text ? ref : null;
  } catch {
    return null;
  }
}

/** Bare keys and malformed/unsupported envelopes are not scoped references. */
export function decodeScopedRef(value: Buffer | Uint8Array): ScopedRef | null {
  const ref = decodeWireRef(Buffer.from(value).toString("utf8"));
  if (!ref) return null;
  const key = Buffer.from(ref.key, "base64url");
  return key.toString("base64url") === ref.key ? { ...ref, key } : null;
}

/** Single local destinations travel as bare keys; callers need no provider-specific codec. */
export function relationRef(
  ref: ScopedRef,
  source: { connection?: string; scope?: string; multipleCollections?: boolean } = {},
): Buffer {
  const connection = ref.connection !== source.connection ? ref.connection : undefined;
  const scope = ref.scope !== source.scope ? ref.scope : undefined;
  return connection !== undefined || scope !== undefined || source.multipleCollections
    ? encodeScopedRef({ connection, scope, collection: ref.collection, key: ref.key })
    : ref.key;
}

/** RefTargets retains string-array storage. These helpers also run in the Studio browser. */
export function encodeRefTarget(target: RefDimensions & { collection: string }): string {
  if (!target.collection) throw new TypeError("Reference target collection is required");
  return target.connection === undefined && target.scope === undefined
    ? target.collection
    : encodeWireRef({ ...target, key: "" });
}

export function decodeRefTarget(value: string): RefDimensions & { collection: string } {
  const scoped = decodeWireRef(value);
  return scoped?.collection && scoped.key === ""
    ? { connection: scoped.connection, scope: scoped.scope, collection: scoped.collection }
    : { collection: value };
}
