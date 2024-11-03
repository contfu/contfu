import { describe, expect, it } from "bun:test";
import { genUid, uuidToBuffer } from "./mappings";

describe("idFromRef()", () => {
  it("should convert a reference to an id", () => {
    const id = genUid(uuidToBuffer("123e4567-e89b-12d3-a456-426614174000"));
    expect(id).toEqual(Buffer.from("3UjmkC_aOBy", "base64url"));
  });
});
