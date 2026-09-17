import { describe, expect, test } from "bun:test";
import { PropertyType, type CollectionSchema } from "@contfu/core";
import { extractLinks, replacePlaceholders } from "./extractLinks";
import { UnknownSchemaPropertyError } from "./unknownSchemaPropertyError";

describe("extractLinks", () => {
  test("extracts scalar and list reference properties into link records", () => {
    const result = extractLinks(
      1,
      { title: "Article", related: "2", relatedMany: ["3", "4"] },
      undefined,
      {
        title: PropertyType.STRING,
        related: PropertyType.REF,
        relatedMany: PropertyType.REFS,
      },
    );

    expect(result.records).toEqual([
      { kind: "internal", prop: "related", from: 1, to: 2 },
      { kind: "internal", prop: "relatedMany", from: 1, to: 3 },
      { kind: "internal", prop: "relatedMany", from: 1, to: 4 },
    ]);
    expect(result.props).toEqual({ title: "Article", related: -1, relatedMany: [-2, -3] });
  });

  test("extracts optional references and replaces their placeholders, including tuple metadata", () => {
    const schema: CollectionSchema = {
      related: PropertyType.REF | PropertyType.OPTIONAL,
      relatedMany: [PropertyType.REFS | PropertyType.OPTIONAL | PropertyType.IDENTITY, []],
      absent: PropertyType.REF | PropertyType.OPTIONAL,
      empty: PropertyType.REFS | PropertyType.OPTIONAL,
      missing: PropertyType.REF | PropertyType.OPTIONAL,
      title: PropertyType.STRING | PropertyType.OPTIONAL,
      count: PropertyType.NUMBER | PropertyType.OPTIONAL,
    };
    const props = {
      related: 2,
      relatedMany: ["3", 4],
      absent: null,
      empty: [],
      title: "5",
      count: 6,
    };
    const result = extractLinks(1, props, undefined, schema);

    expect(result.records).toEqual([
      { kind: "internal", prop: "related", from: 1, to: 2 },
      { kind: "internal", prop: "relatedMany", from: 1, to: 3 },
      { kind: "internal", prop: "relatedMany", from: 1, to: 4 },
    ]);
    expect(result.props).toEqual({ ...props, related: -1, relatedMany: [-2, -3] });
    expect(replacePlaceholders(result.props, undefined, schema, [101, 102, 103]).props).toEqual({
      ...props,
      related: 101,
      relatedMany: [102, 103],
    });
    expect(props.related).toBe(2);
    expect(props.relatedMany).toEqual(["3", 4]);
  });

  test("retains null or missing optional reference lists without creating links", () => {
    const schema = {
      nullable: PropertyType.REFS | PropertyType.OPTIONAL,
      missing: PropertyType.REFS | PropertyType.OPTIONAL,
    };
    const result = extractLinks(1, { nullable: null }, null, schema);
    expect(result.records).toEqual([]);
    expect(replacePlaceholders(result.props, result.content, schema, [])).toEqual({
      props: { nullable: null },
      content: null,
    });
  });

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
