import { describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import { safeCast, typeCompatibility } from "./mappings";

const T = PropertyType;

describe("safeCast", () => {
  test("direct overlap returns null", () => {
    expect(safeCast(T.STRING, T.STRING)).toBeNull();
  });

  test.each([
    [T.NUMBER, T.STRING, "string"],
    [T.NUMBERS, T.STRINGS, "string"],
    [T.REF, T.STRING, "string"],
    [T.REFS, T.STRINGS, "string"],
    [T.BOOLEAN, T.STRING, "string"],
    [T.DATE, T.STRING, "string"],
  ] as const)("safe cast %p → %p returns %p", (src, tgt, expected) => {
    expect(safeCast(src, tgt)).toBe(expected);
  });

  test.each([
    [T.STRING, T.NUMBER],
    [T.FILE, T.STRING],
    [T.STRING, T.BOOLEAN],
  ] as const)("incompatible %p → %p returns null", (src, tgt) => {
    expect(safeCast(src, tgt)).toBeNull();
  });

  test("a source type fully covered by a target union needs no cast", () => {
    expect(safeCast(T.NUMBER, T.STRING | T.NUMBER)).toBeNull();
  });

  test("partial bitmask overlap is not a safe cast", () => {
    expect(safeCast(T.FILE | T.STRING, T.FILE)).toBeNull();
  });

  test("GeoPoint has no implicit casts", () => {
    expect(safeCast(T.GEOPOINT, T.STRING)).toBeNull();
    expect(safeCast(T.STRING, T.GEOPOINT)).toBeNull();
  });
});

describe("typeCompatibility", () => {
  test("direct match", () => {
    expect(typeCompatibility(T.STRING, T.STRING)).toEqual({
      compatible: true,
      cast: null,
    });
  });

  test("safe cast exists", () => {
    expect(typeCompatibility(T.NUMBER, T.STRING)).toEqual({
      compatible: true,
      cast: "string",
    });
  });

  test("incompatible", () => {
    expect(typeCompatibility(T.STRING, T.NUMBER)).toEqual({
      compatible: false,
    });
  });

  test("requires every source union member to be accepted by the target", () => {
    expect(typeCompatibility(T.FILE | T.STRING, T.FILE)).toEqual({ compatible: false });
    expect(typeCompatibility(T.FILE | T.STRING, T.FILE | T.STRING)).toEqual({
      compatible: true,
      cast: null,
    });
  });
});

describe("ENUM/ENUMS safe casts", () => {
  test("STRING → ENUM cast is 'enum'", () => {
    expect(safeCast(T.STRING, T.ENUM)).toBe("enum");
  });

  test("STRINGS → ENUMS cast is 'enum'", () => {
    expect(safeCast(T.STRINGS, T.ENUMS)).toBe("enum");
  });

  test("ENUM → STRING cast is 'string'", () => {
    expect(safeCast(T.ENUM, T.STRING)).toBe("string");
  });

  test("ENUMS → STRINGS cast is 'string'", () => {
    expect(safeCast(T.ENUMS, T.STRINGS)).toBe("string");
  });

  test("ENUM is compatible with ENUM", () => {
    expect(typeCompatibility(T.ENUM, T.ENUM)).toEqual({ compatible: true, cast: null });
  });

  test("ENUMS is compatible with ENUMS", () => {
    expect(typeCompatibility(T.ENUMS, T.ENUMS)).toEqual({ compatible: true, cast: null });
  });
});
