import { describe, expect, it } from "bun:test";
import { camelCase } from "./mappings";

describe("camelCase()", () => {
  it("should convert kebab-case to camelCase", () => {
    expect(camelCase("foo-bar_baz")).toBe("fooBarBaz");
    expect(camelCase("Some Text")).toBe("someText");
    expect(camelCase("already-camelCase")).toBe("alreadyCamelCase");
    expect(camelCase("multiple   spaces   here")).toBe("multipleSpacesHere");
    expect(camelCase("mixed-CASE_string")).toBe("mixedCASEString");
  });
});
