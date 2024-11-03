import { describe, expect, it } from "bun:test";
import { hashId } from "./crypto";

describe("uuid()", () => {
  it("should hash a string", () => {
    expect(hashId("test")).toEqual("a94a8fe5ccb19ba61c4c0873d391e987");
  });
});
