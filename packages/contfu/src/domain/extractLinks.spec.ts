import { describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import { extractLinks } from "./extractLinks";
import { UnknownSchemaPropertyError } from "./unknownSchemaPropertyError";

describe("extractLinks", () => {
  test("fails closed for an unrecognized numeric reference property", () => {
    expect(() =>
      extractLinks(1, { title: "Article", related: 2 }, undefined, { title: PropertyType.STRING }),
    ).toThrow(UnknownSchemaPropertyError);
  });

  test("retains unknown non-reference metadata for forward compatibility", () => {
    const result = extractLinks(1, { title: "Article", metadata: "future" }, undefined, {
      title: PropertyType.STRING,
    });
    expect(result.props.metadata).toBe("future");
  });
});
