import { describe, expect, it } from "bun:test";
import { idFromRef, refFromUuid } from "./mappings";

describe("idFromRef()", () => {
  it("should convert a reference to an id", () => {
    expect(
      idFromRef(refFromUuid("123e4567-e89b-12d3-a456-426614174000"))
    ).toEqual(Buffer.from("3UjmkC_aOByUkLno", "base64url"));
  });
});
