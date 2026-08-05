import { generateTypeScript, PROPERTY_TYPE_MASK, PropertyType } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { generateTypes } from "./generateTypes";

describe("generateTypes", () => {
  it("generates types for a single collection", () => {
    const result = generateTypes({
      blogPosts: {
        title: PropertyType.STRING,
        published: PropertyType.BOOLEAN,
        views: PropertyType.NUMBER,
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("generates types for multiple collections", () => {
    const result = generateTypes({
      blogPosts: {
        title: PropertyType.STRING,
        tags: PropertyType.STRINGS,
      },
      authors: {
        name: PropertyType.STRING,
        featured: PropertyType.BOOLEAN,
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("maps all property types correctly", () => {
    const result = generateTypes({
      everything: {
        str: PropertyType.STRING,
        strs: PropertyType.STRINGS,
        num: PropertyType.NUMBER,
        nums: PropertyType.NUMBERS,
        color: PropertyType.COLOR,
        bool: PropertyType.BOOLEAN,
        ref: PropertyType.REF,
        refs: PropertyType.REFS,
        file: PropertyType.FILE,
        files: PropertyType.FILES,
        date: PropertyType.DATE,
        plainDate: PropertyType.PLAINDATE,
        location: PropertyType.GEOPOINT,
      },
    });
    expect(result).toMatchSnapshot();
  });

  it("preserves enum literal unions for nullable enum properties", () => {
    const enumValues = ["Vorverkauf", "Buchen"];
    const result = generateTypes({
      callsToAction: {
        requiredEnum: [PropertyType.ENUM, enumValues],
        nullableEnum: [PropertyType.ENUM | PropertyType.NULL, enumValues],
        requiredEnums: [PropertyType.ENUMS, enumValues],
        nullableEnums: [PropertyType.ENUMS | PropertyType.NULL, enumValues],
      },
    });

    expect(result).toContain('requiredEnum: "Vorverkauf" | "Buchen";');
    expect(result).toContain('nullableEnum: "Vorverkauf" | "Buchen";');
    expect(result).toContain('requiredEnums: ("Vorverkauf" | "Buchen")[];');
    expect(result).toContain('nullableEnums: ("Vorverkauf" | "Buchen")[];');
  });

  it("retains non-enum members in mixed enum masks", () => {
    const result = generateTypes({
      assets: {
        icon: [PropertyType.ENUM | PropertyType.FILE, ["a", "b"]],
      },
    });

    expect(result).toContain('import type { FileMetadata } from "@contfu/core";');
    expect(result).toContain('icon: FileMetadata | "a" | "b";');
  });

  it("matches core type generation for every renderable property type", () => {
    const renderableTypes = Object.entries(PropertyType).filter(
      ([, type]) => type !== PropertyType.NULL && (type & PROPERTY_TYPE_MASK) === type,
    );
    const extractPropertyType = (output: string, property: string): string => {
      const rendered = output.match(new RegExp(`^\\s+${property}: (.+);$`, "m"))?.[1];
      if (!rendered) throw new Error(`Missing generated type for ${property}`);
      return rendered;
    };

    const coreTypes = Object.fromEntries(
      renderableTypes.map(([name, type]) => {
        const property = name.toLowerCase();
        const output = generateTypeScript([
          { name: "parity", displayName: "Parity", schema: { [property]: type } },
        ]);
        return [name, extractPropertyType(output, property)];
      }),
    );
    const clientTypes = Object.fromEntries(
      renderableTypes.map(([name, type]) => {
        const property = name.toLowerCase();
        const output = generateTypes({ parity: { [property]: type } });
        return [name, extractPropertyType(output, property)];
      }),
    );

    expect(clientTypes).toEqual(coreTypes);
  });

  it("imports Color for color fields", () => {
    const result = generateTypes({ themes: { accent: PropertyType.COLOR } });

    expect(result).toContain('import type { Color } from "@contfu/core";');
    expect(result).toContain("accent: Color;");
  });

  it("generates a string and FileMetadata union for mixed icon values", () => {
    const result = generateTypes({
      pages: { icon: PropertyType.FILE | PropertyType.STRING | PropertyType.NULL },
    });

    expect(result).toContain('import type { FileMetadata } from "@contfu/core";');
    expect(result).toContain("icon: string | FileMetadata;");
  });

  it("does not generate CollectionMap", () => {
    const result = generateTypes({
      articles: { title: PropertyType.STRING },
      tags: { label: PropertyType.STRING },
    });
    expect(result).not.toContain("CollectionMap");
    expect(result).toContain("ArticlesProps");
    expect(result).toContain("TagsProps");
  });

  it("capitalises collection name for the type name", () => {
    const result = generateTypes({ blogPosts: { title: PropertyType.STRING } });
    expect(result).toContain("BlogPostsProps");
  });

  it("generates CollectionMap for query factory usage", () => {
    const result = generateTypes(
      {
        articles: { title: PropertyType.STRING },
        tags: { label: PropertyType.STRING },
      },
      true,
    );

    expect(result).toContain("export type ArticlesProps");
    expect(result).toContain("export type TagsProps");
    expect(result).toContain("export type CollectionMap = {");
    expect(result).toContain("  articles: ArticlesProps;");
    expect(result).toContain("  tags: TagsProps;");
  });
});
