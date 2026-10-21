import { describe, expect, test } from "bun:test";
import {
  decodeRefTarget,
  decodeScopedRef,
  encodeRefTarget,
  encodeScopedRef,
  relationRef,
} from "./scoped-ref";

describe("shared scoped references", () => {
  test("roundtrips every dimension and lossless binary/empty keys through base64url transport", () => {
    for (const key of [
      Buffer.from([0, 255, 128, 0]),
      Buffer.from("drafts.ü:/雪"),
      Buffer.alloc(0),
    ]) {
      const ref = { connection: "project", scope: "dataset:B%雪", collection: "author", key };
      const encoded = encodeScopedRef(ref);
      expect(decodeScopedRef(Buffer.from(encoded.toString("base64url"), "base64url"))).toEqual(ref);
    }
  });
  test("uses a minimal version prefix and fixed colon-separated fields", () => {
    expect(encodeScopedRef({ scope: "B", key: Buffer.from("a") }).toString()).toBe("1::B::YQ");
    expect(
      encodeScopedRef({ connection: "p:q", collection: "雪", key: Buffer.alloc(0) }).toString(),
    ).toBe("1:p%3Aq::%E9%9B%AA:");
    expect(encodeRefTarget({ scope: "B", collection: "author" })).toBe("1::B:author:");
    expect(decodeScopedRef(Buffer.from("1::::"))).toEqual({ key: Buffer.alloc(0) });
  });
  test("does not confuse bare keys, malformed shapes, or other versions with envelopes", () => {
    for (const value of [
      "123",
      '["api::author.author","1"]',
      "2::::YQ",
      "1:[]",
      "1::::YQ==",
      "1::::YR",
      "1::::YQ:extra",
      "1:%ZZ:::YQ",
      "1:%FF:::YQ",
      "1:%61:::YQ",
      "1::::%59Q",
      'scoped-ref:v1:{"key":"YQ"}',
    ])
      expect(decodeScopedRef(Buffer.from(value))).toBeNull();
  });
  test("emits bare local single-target keys and envelopes only for differing dimensions or multiple collections", () => {
    const key = Buffer.from("1");
    expect(
      relationRef(
        { connection: "p", scope: "A", collection: "person", key },
        { connection: "p", scope: "A" },
      ),
    ).toEqual(key);
    expect(decodeScopedRef(relationRef({ scope: "B", key }, { scope: "A" }))).toEqual({
      scope: "B",
      key,
    });
    expect(
      decodeScopedRef(relationRef({ collection: "person", key }, { multipleCollections: true })),
    ).toEqual({ collection: "person", key });
  });
  test("qualified target descriptors are collision-safe and work without a browser Buffer polyfill", () => {
    const target = { scope: "A;ref=B", collection: "雪" };
    expect(decodeRefTarget(encodeRefTarget(target))).toEqual(target);
    expect(decodeRefTarget("author")).toEqual({ collection: "author" });
    expect(encodeRefTarget(target)).not.toEqual(
      encodeRefTarget({ scope: "A", collection: ";ref=B雪" }),
    );
    const buffer = globalThis.Buffer;
    try {
      globalThis.Buffer = undefined as unknown as typeof Buffer;
      expect(decodeRefTarget(encodeRefTarget(target))).toEqual(target);
    } finally {
      globalThis.Buffer = buffer;
    }
  });
});
