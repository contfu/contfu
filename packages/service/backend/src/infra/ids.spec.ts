import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { decodeId, encodeId, idSchema, type EntityType } from "./ids";
import * as v from "valibot";

const ENTITIES: EntityType[] = [
  "user",
  "source",
  "collection",
  "consumer",
  "sourceCollection",
  "influx",
];

describe("ids (passthrough mode — no CONTFU_SECRET)", () => {
  beforeEach(() => {
    delete process.env.CONTFU_SECRET;
    // Force re-initialization by resetting the module
    // Since ids.ts uses lazy init, we need to re-import
  });

  it("encodeId returns string of the number", () => {
    expect(encodeId("source", 42)).toBe("42");
  });

  it("decodeId returns the number from a string", () => {
    expect(decodeId("source", "42")).toBe(42);
  });

  it("decodeId returns null for NaN input", () => {
    expect(decodeId("source", "abc")).toBeNull();
  });

  it("decodeId returns null for float input", () => {
    expect(decodeId("source", "3.14")).toBeNull();
  });

  it("round-trips through encode/decode", () => {
    for (const entity of ENTITIES) {
      const id = 123;
      const encoded = encodeId(entity, id);
      const decoded = decodeId(entity, encoded);
      expect(decoded).toBe(id);
    }
  });

  it("idSchema accepts string and returns number", () => {
    const schema = idSchema("source");
    const result = v.parse(schema, "42");
    expect(result).toBe(42);
  });

  it("idSchema accepts number and returns number", () => {
    const schema = idSchema("source");
    const result = v.parse(schema, 42);
    expect(result).toBe(42);
  });

  it("idSchema rejects invalid string", () => {
    const schema = idSchema("source");
    expect(() => v.parse(schema, "not-a-number")).toThrow();
  });
});

describe("ids (with CONTFU_SECRET)", () => {
  // We need a fresh module for this test suite since the module lazy-inits.
  // Use dynamic import after setting env var.
  let encode: typeof encodeId;
  let decode: typeof decodeId;
  let schema: typeof idSchema;

  beforeEach(async () => {
    // Set the secret before importing
    process.env.CONTFU_SECRET = "test-secret-for-sqids";

    // Bust the module cache to get fresh init
    const modulePath = require.resolve("./ids");
    delete require.cache[modulePath];
    const mod = await import("./ids");
    encode = mod.encodeId;
    decode = mod.decodeId;
    schema = mod.idSchema;
  });

  afterEach(() => {
    delete process.env.CONTFU_SECRET;
    // Clean up module cache
    const modulePath = require.resolve("./ids");
    delete require.cache[modulePath];
  });

  it("encodeId returns an alphanumeric string of at least 6 chars", () => {
    const encoded = encode("source", 1);
    expect(encoded.length).toBeGreaterThanOrEqual(6);
    expect(encoded).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("encodeId does not return a plain number string", () => {
    const encoded = encode("source", 1);
    expect(encoded).not.toBe("1");
  });

  it("round-trips for every entity type", () => {
    for (const entity of ENTITIES) {
      for (const id of [1, 42, 999, 100000]) {
        const encoded = encode(entity, id);
        const decoded = decode(entity, encoded);
        expect(decoded).toBe(id);
      }
    }
  });

  it("different entity types produce different encodings for same ID", () => {
    const encodings = ENTITIES.map((entity) => encode(entity, 42));
    const unique = new Set(encodings);
    expect(unique.size).toBe(ENTITIES.length);
  });

  it("rejects cross-entity decoding", () => {
    const encoded = encode("source", 42);
    // Decoding a source-encoded ID as a collection should fail
    const decoded = decode("collection", encoded);
    expect(decoded).toBeNull();
  });

  it("decodeId returns null for invalid/crafted input", () => {
    expect(decode("source", "!!!")).toBeNull();
    expect(decode("source", "")).toBeNull();
  });

  it("idSchema validates and decodes", () => {
    const s = schema("source");
    const encoded = encode("source", 7);
    const result = v.parse(s, encoded);
    expect(result).toBe(7);
  });

  it("idSchema rejects invalid encoded ID", () => {
    const s = schema("source");
    expect(() => v.parse(s, "definitely-not-valid-!!!")).toThrow();
  });
});
