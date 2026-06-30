import { describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateTypeScript,
  generateApplicationIntegrationTypes,
  PropertyType,
  schemaType,
  schemaEnumValues,
  mergeSchemaValues,
  type CollectionSchema,
} from "./schemas";

/**
 * Write generated TS code + assertion lines to a temp file
 * and run tsgo --noEmit to verify it compiles.
 */
async function assertCompiles(code: string, description?: string): Promise<void> {
  const file = join(tmpdir(), `contfu-type-check-${Date.now()}.ts`);
  await Bun.write(file, code);
  try {
    const proc =
      await Bun.$`bunx tsgo --noEmit --ignoreConfig --strict --target ESNext --moduleResolution bundler ${file}`.quiet();
    if (proc.exitCode !== 0) {
      throw new Error(
        `Type check failed${description ? ` (${description})` : ""}:\n${proc.stderr.toString()}`,
      );
    }
  } finally {
    if (await Bun.file(file).exists()) await Bun.$`rm ${file}`.quiet();
  }
}

/** Expect tsgo to fail on the given code (negative type test). */
async function assertDoesNotCompile(code: string): Promise<void> {
  const file = join(tmpdir(), `contfu-type-check-${Date.now()}.ts`);
  await Bun.write(file, code);
  try {
    const proc =
      await Bun.$`bunx tsgo --noEmit --ignoreConfig --strict --target ESNext --moduleResolution bundler ${file}`.quiet();
    if (proc.exitCode === 0) {
      throw new Error("Expected type check to fail, but it succeeded");
    }
  } catch {
    // expected
  } finally {
    if (await Bun.file(file).exists()) await Bun.$`rm ${file}`.quiet();
  }
}

describe("generateTypeScript", () => {
  it("generates TypeScript unions for schema type bitmasks", () => {
    const ts = generateTypeScript([
      {
        name: "tasks",
        displayName: "Tasks",
        schema: {
          computed:
            PropertyType.STRING | PropertyType.NUMBER | PropertyType.BOOLEAN | PropertyType.DATE,
          summary:
            PropertyType.STRING | PropertyType.STRINGS | PropertyType.NUMBER | PropertyType.NUMBERS,
        },
      },
    ]);

    expect(ts).toContain("computed: string | number | boolean;");
    expect(ts).toContain("summary: string | string[] | number | number[];");
  });

  it("generates string for REF without refTargets", () => {
    const ts = generateTypeScript([
      { name: "blogPosts", displayName: "Blog Posts", schema: { author: PropertyType.REF } },
    ]);
    expect(ts).toContain("author: string;");
  });

  it("generates interface name for REF with single target", () => {
    const ts = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { author: PropertyType.REF },
        refTargets: { author: ["authors"] },
      },
    ]);
    expect(ts).toContain("author: Authors;");
  });

  it("generates union for REF with multiple targets", () => {
    const ts = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { author: PropertyType.REF },
        refTargets: { author: ["authors", "editors"] },
      },
    ]);
    expect(ts).toContain("author: Authors | Editors;");
  });

  it("generates typed array for REFS with single target", () => {
    const ts = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { tags: PropertyType.REFS },
        refTargets: { tags: ["tags"] },
      },
    ]);
    expect(ts).toContain("tags: Tags[];");
  });

  it("generates union array for REFS with multiple targets", () => {
    const ts = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { related: PropertyType.REFS },
        refTargets: { related: ["articles", "videos"] },
      },
    ]);
    expect(ts).toContain("related: (Articles | Videos)[];");
  });

  it("generates enum union for ENUM with values", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { status: [PropertyType.ENUM, ["draft", "published", "archived"]] },
      },
    ]);
    expect(ts).toContain(`status: "draft" | "published" | "archived";`);
  });

  it("generates string for ENUM without values", () => {
    const ts = generateTypeScript([
      { name: "posts", displayName: "Posts", schema: { status: PropertyType.ENUM } },
    ]);
    expect(ts).toContain("status: string;");
  });

  it("generates enum array for ENUMS with values", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { tags: [PropertyType.ENUMS, ["a", "b"]] },
      },
    ]);
    expect(ts).toContain(`tags: ("a" | "b")[];`);
  });

  it("generates string[] for ENUMS without values", () => {
    const ts = generateTypeScript([
      { name: "posts", displayName: "Posts", schema: { tags: PropertyType.ENUMS } },
    ]);
    expect(ts).toContain("tags: string[];");
  });

  it("generates Block[] for BLOCK", () => {
    const ts = generateTypeScript([
      { name: "posts", displayName: "Posts", schema: { body: PropertyType.BLOCK } },
    ]);
    expect(ts).toContain('import type { Block } from "@contfu/core";');
    expect(ts).toContain("body: Block[];");
  });

  it("imports Block for nullable BLOCK bitmasks", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { body: PropertyType.BLOCK | PropertyType.NULL },
      },
    ]);
    expect(ts).toContain('import type { Block } from "@contfu/core";');
    expect(ts).toContain("body: Block[];");
  });

  it("generates Color imports for COLOR fields and bitmasks", () => {
    const ts = generateTypeScript([
      {
        name: "themes",
        displayName: "Themes",
        schema: {
          accent: PropertyType.COLOR,
          token: PropertyType.COLOR | PropertyType.STRING,
        },
      },
    ]);

    expect(ts).toContain('import type { Color } from "@contfu/core";');
    expect(ts).toContain("accent: Color;");
    expect(ts).toContain("token: string | Color;");
  });

  it("generates string[] for REFS without refTargets", () => {
    const ts = generateTypeScript([
      { name: "blogPosts", displayName: "Blog Posts", schema: { tags: PropertyType.REFS } },
    ]);
    expect(ts).toContain("tags: string[];");
  });

  it("generates FileMetadata for FILE", () => {
    const ts = generateTypeScript([
      { name: "assets", displayName: "Assets", schema: { hero: PropertyType.FILE } },
    ]);
    expect(ts).toContain('import type { FileMetadata } from "@contfu/core";');
    expect(ts).toContain("hero: FileMetadata;");
  });

  it("generates FileMetadata[] for FILES", () => {
    const ts = generateTypeScript([
      { name: "assets", displayName: "Assets", schema: { gallery: PropertyType.FILES } },
    ]);
    expect(ts).toContain('import type { FileMetadata } from "@contfu/core";');
    expect(ts).toContain("gallery: FileMetadata[];");
  });

  it("generates any for JSON", () => {
    const ts = generateTypeScript([
      { name: "assets", displayName: "Assets", schema: { metadata: PropertyType.JSON } },
    ]);
    expect(ts).toContain("metadata: any;");
  });

  it("generates GeoPoint for GEOPOINT", () => {
    const ts = generateTypeScript([
      { name: "venues", displayName: "Venues", schema: { location: PropertyType.GEOPOINT } },
    ]);
    expect(ts).toContain('import type { GeoPoint } from "@contfu/core";');
    expect(ts).toContain("location: GeoPoint;");
  });

  it("generates typed component blocks from BLOCK schema metadata", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { body: [PropertyType.BLOCK, ["shared.seo", "shared.hero"]] },
      },
    ]);
    expect(ts).toContain(
      'export type SharedSeoComponent = ["x", "shared.seo", Record<string, any>, Block[]];',
    );
    expect(ts).toContain(
      'export type SharedHeroComponent = ["x", "shared.hero", Record<string, any>, Block[]];',
    );
    expect(ts).toContain("body: (SharedSeoComponent | SharedHeroComponent)[];");
  });

  it("generates typed component blocks from nullable BLOCK schema metadata", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { body: [PropertyType.BLOCK | PropertyType.NULL, ["shared.hero"]] },
      },
    ]);
    expect(ts).toContain(
      'export type SharedHeroComponent = ["x", "shared.hero", Record<string, any>, Block[]];',
    );
    expect(ts).toContain("body: (SharedHeroComponent)[];");
  });

  it("generates different component block unions per dynamic-zone field", () => {
    const ts = generateTypeScript([
      {
        name: "pages",
        displayName: "Pages",
        schema: {
          heroZone: [PropertyType.BLOCK, ["hero", "callToAction"]],
          sidebarZone: [PropertyType.BLOCK, ["teaser"]],
          seo: [PropertyType.BLOCK, ["seo"]],
        },
        components: [
          { name: "hero", props: { title: PropertyType.STRING } },
          { name: "callToAction", props: { label: PropertyType.STRING } },
          { name: "teaser", props: { eyebrow: PropertyType.STRING } },
          { name: "seo", props: { metaTitle: PropertyType.STRING } },
        ],
      },
    ]);

    expect(ts).toContain("heroZone: (HeroComponent | CallToActionComponent)[];");
    expect(ts).toContain("sidebarZone: (TeaserComponent)[];");
    expect(ts).toContain("seo: (SeoComponent)[];");
    expect(ts).toContain('export type HeroComponent = ["x", "hero", { title: string }, Block[]];');
  });
});

describe("generateApplicationIntegrationTypes", () => {
  it("imports Color for custom block props", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "pages",
        displayName: "Pages",
        schema: { body: [PropertyType.BLOCK, ["hero"]] },
        components: [{ name: "hero", props: { background: PropertyType.COLOR } }],
      },
    ]);

    expect(ts).toContain('import type { Block, Color } from "@contfu/core";');
    expect(ts).toContain(
      'export type HeroComponent = ["x", "hero", { background: Color }, Block[]];',
    );
  });

  it("uses self-referencing lookup for refTargets", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { author: PropertyType.REF },
        refTargets: { author: ["authors"] },
      },
    ]);
    expect(ts).toContain('author: ContfuCollections["authors"];');
  });

  it("uses lookup union for multiple targets", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { creator: PropertyType.REF },
        refTargets: { creator: ["authors", "editors"] },
      },
    ]);
    expect(ts).toContain('creator: ContfuCollections["authors"] | ContfuCollections["editors"];');
  });

  it("uses lookup array for REFS", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { tags: PropertyType.REFS },
        refTargets: { tags: ["tags"] },
      },
    ]);
    expect(ts).toContain('tags: ContfuCollections["tags"][];');
  });

  it("imports GeoPoint for collection, inflow, and component block props", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "venues",
        displayName: "Venues",
        schema: { location: PropertyType.GEOPOINT },
        inflowSchemas: [
          { title: PropertyType.STRING },
          { title: PropertyType.STRING, location: PropertyType.GEOPOINT },
        ],
        components: [{ name: "map", props: { center: PropertyType.GEOPOINT } }],
      },
    ]);

    expect(ts).toContain('import type { Block, GeoPoint } from "@contfu/core";');
    expect(ts).toContain('export type MapComponent = ["x", "map", { center: GeoPoint }, Block[]];');
    expect(ts).toContain("location: GeoPoint;");
  });
});

describe("generated types compile-time checks", () => {
  it("REF with target compiles: property is typed as the target interface", async () => {
    const generated = generateTypeScript([
      {
        name: "authors",
        displayName: "Authors",
        schema: { name: PropertyType.STRING },
      },
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { title: PropertyType.STRING, author: PropertyType.REF },
        refTargets: { author: ["authors"] },
      },
    ]);

    await assertCompiles(
      generated +
        `
        const post: BlogPosts = {} as BlogPosts;
        // author should be Authors, which has 'name'
        const authorName: string = post.author.name;
      `,
      "REF property typed as target interface",
    );
  });

  it("REF with target rejects: accessing non-existent property on target", async () => {
    const generated = generateTypeScript([
      {
        name: "authors",
        displayName: "Authors",
        schema: { name: PropertyType.STRING },
      },
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { title: PropertyType.STRING, author: PropertyType.REF },
        refTargets: { author: ["authors"] },
      },
    ]);

    await assertDoesNotCompile(
      generated +
        `
        const post: BlogPosts = {} as BlogPosts;
        // 'email' does not exist on Authors
        const email: string = post.author.email;
      `,
    );
  });

  it("REFS with target compiles: property is typed as target array", async () => {
    const generated = generateTypeScript([
      {
        name: "tags",
        displayName: "Tags",
        schema: { label: PropertyType.STRING },
      },
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { title: PropertyType.STRING, tags: PropertyType.REFS },
        refTargets: { tags: ["tags"] },
      },
    ]);

    await assertCompiles(
      generated +
        `
        const post: BlogPosts = {} as BlogPosts;
        const firstLabel: string = post.tags[0].label;
      `,
      "REFS property typed as target array",
    );
  });

  it("REF union compiles: property accepts any of the union members", async () => {
    const generated = generateTypeScript([
      {
        name: "authors",
        displayName: "Authors",
        schema: { name: PropertyType.STRING },
      },
      {
        name: "editors",
        displayName: "Editors",
        schema: { department: PropertyType.STRING },
      },
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { creator: PropertyType.REF },
        refTargets: { creator: ["authors", "editors"] },
      },
    ]);

    await assertCompiles(
      generated +
        `
        const post: BlogPosts = {} as BlogPosts;
        // creator is Authors | Editors — assignment to the union type works
        const creator: Authors | Editors = post.creator;
      `,
      "REF union type",
    );
  });

  it("REF without target compiles: property is plain string", async () => {
    const generated = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { externalRef: PropertyType.REF },
      },
    ]);

    await assertCompiles(
      generated +
        `
        const post: BlogPosts = {} as BlogPosts;
        const ref: string = post.externalRef;
      `,
      "REF without target is string",
    );
  });

  it("REF without target rejects: accessing properties on string", async () => {
    const generated = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { externalRef: PropertyType.REF },
      },
    ]);

    await assertDoesNotCompile(
      generated +
        `
        const post: BlogPosts = {} as BlogPosts;
        // string doesn't have .name
        const name: string = post.externalRef.name;
      `,
    );
  });

  it("FILE and FILES compile as metadata with url", async () => {
    const generated = generateApplicationIntegrationTypes([
      {
        name: "assets",
        displayName: "Assets",
        schema: { cover: PropertyType.FILE, gallery: PropertyType.FILES },
      },
    ]).replace(
      'import type { FileMetadata } from "@contfu/core";',
      "type FileMetadata = { url: string };",
    );

    await assertCompiles(
      generated +
        `
        type CMap = ContfuCollections;
        const asset: CMap["assets"] = {} as CMap["assets"];
        const coverUrl: string = asset.cover.url;
        const galleryUrl: string = asset.gallery[0].url;
      `,
      "FILE and FILES expose FileMetadata url",
    );
  });

  it("FILE rejects string-only handling", async () => {
    const generated = generateApplicationIntegrationTypes([
      {
        name: "assets",
        displayName: "Assets",
        schema: { cover: PropertyType.FILE },
      },
    ]).replace(
      'import type { FileMetadata } from "@contfu/core";',
      "type FileMetadata = { url: string };",
    );

    await assertDoesNotCompile(
      generated +
        `
        const asset: ContfuCollections["assets"] = {} as ContfuCollections["assets"];
        const cover: string = asset.cover;
      `,
    );
  });

  it("consumer types with refTargets compile with typed query client pattern", async () => {
    const generated = generateApplicationIntegrationTypes([
      {
        name: "authors",
        displayName: "Authors",
        schema: { name: PropertyType.STRING },
      },
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: {
          title: PropertyType.STRING,
          author: PropertyType.REF,
          tags: PropertyType.REFS,
        },
        refTargets: {
          author: ["authors"],
          tags: ["tags"],
        },
      },
      {
        name: "tags",
        displayName: "Tags",
        schema: { label: PropertyType.STRING },
      },
    ]);

    await assertCompiles(
      generated +
        `
        // Simulate the query client pattern: CMap = ContfuCollections
        type CMap = ContfuCollections;

        // blogPosts.author is Authors (has .name)
        type AuthorType = CMap["blogPosts"]["author"];
        const a: AuthorType = {} as AuthorType;
        const authorName: string = a.name;

        // blogPosts.tags is Tags[] (each has .label)
        type TagsType = CMap["blogPosts"]["tags"];
        const tags: TagsType = [] as TagsType;
        const firstLabel: string = tags[0].label;
      `,
      "consumer types with query client pattern",
    );
  });
});

describe("generateTypeScript with inflowSchemas", () => {
  it("single inflow still emits interface", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { title: PropertyType.STRING },
        inflowSchemas: [{ title: PropertyType.STRING }],
      },
    ]);
    expect(ts).toContain("export interface Posts {");
    expect(ts).toContain("title: string;");
  });

  it("two distinct inflows emit union type", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { title: PropertyType.STRING },
        inflowSchemas: [
          { title: PropertyType.STRING },
          { title: PropertyType.STRING, category: PropertyType.STRING },
        ],
      },
    ]);
    expect(ts).toContain("export type Posts =");
    expect(ts).toContain("  | {");
    expect(ts).toContain("    title: string;");
    expect(ts).toContain("  };");
    expect(ts).not.toContain("export interface Posts");
  });

  it("duplicate inflows deduplicate to single member, still emits interface", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { title: PropertyType.STRING },
        inflowSchemas: [{ title: PropertyType.STRING }, { title: PropertyType.STRING }],
      },
    ]);
    expect(ts).toContain("export interface Posts {");
    expect(ts).not.toContain("export type Posts =");
  });
});

describe("generateApplicationIntegrationTypes with inflowSchemas", () => {
  it("single inflow still emits block object", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "posts",
        displayName: "Posts",
        schema: { title: PropertyType.STRING },
        inflowSchemas: [{ title: PropertyType.STRING }],
      },
    ]);
    expect(ts).toContain("posts: {");
    expect(ts).toContain("title: string;");
  });

  it("two distinct inflows emit multi-line union", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "posts",
        displayName: "Posts",
        schema: { title: PropertyType.STRING },
        inflowSchemas: [
          { title: PropertyType.STRING },
          { title: PropertyType.STRING, category: PropertyType.STRING },
        ],
      },
    ]);
    expect(ts).toContain("posts:");
    expect(ts).toContain("    | {");
    expect(ts).toContain("        title: string;");
    expect(ts).toContain("      };");
  });

  it("duplicate inflows deduplicate to single member, still emits block object", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "posts",
        displayName: "Posts",
        schema: { title: PropertyType.STRING },
        inflowSchemas: [{ title: PropertyType.STRING }, { title: PropertyType.STRING }],
      },
    ]);
    expect(ts).toContain("posts: {");
    expect(ts).not.toContain("posts: { title: string } | {");
  });
});

describe("$content system schema key", () => {
  it("generateTypeScript maps $content to content: Block[] and prepends Block import", () => {
    const ts = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { title: PropertyType.STRING, $content: 0 },
      },
    ]);
    expect(ts).toContain(`import type { Block } from "@contfu/core";`);
    expect(ts).toContain("content: Block[];");
    expect(ts).not.toContain("$content");
  });

  it("generateTypeScript omits Block import when no collection uses $content", () => {
    const ts = generateTypeScript([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { title: PropertyType.STRING },
      },
    ]);
    expect(ts).not.toContain("import type { Block }");
    expect(ts).not.toContain("Block[]");
  });

  it("generateApplicationIntegrationTypes maps $content to content: Block[] and prepends Block import", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { title: PropertyType.STRING, $content: 0 },
      },
    ]);
    expect(ts).toContain(`import type { Block } from "@contfu/core";`);
    expect(ts).toContain("content: Block[];");
  });

  it("generateTypeScript emits content: Block[] in union members from inflow schemas", () => {
    const ts = generateTypeScript([
      {
        name: "posts",
        displayName: "Posts",
        schema: { title: PropertyType.STRING, $content: 0 },
        inflowSchemas: [
          { title: PropertyType.STRING, $content: 0 },
          { title: PropertyType.STRING, category: PropertyType.STRING, $content: 0 },
        ],
      },
    ]);
    expect(ts).toContain(`import type { Block } from "@contfu/core";`);
    expect(ts).toContain("content: Block[];");
    expect(ts).not.toContain("$content");
  });

  it("generateApplicationIntegrationTypes renders $locale only once for localized collections", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "posts",
        displayName: "Posts",
        schema: {
          title: PropertyType.STRING,
          $content: PropertyType.NULL,
          $locale: [PropertyType.ENUM, ["en", "de"]],
        },
        inflowSchemas: [
          {
            title: PropertyType.STRING,
            $content: PropertyType.NULL,
            $locale: [PropertyType.ENUM, ["en", "de"]],
          },
          {
            title: PropertyType.STRING,
            category: PropertyType.STRING,
            $content: PropertyType.NULL,
            $locale: [PropertyType.ENUM, ["en", "de"]],
          },
        ],
        i18n: { localized: true, locales: ["en", "de"] },
      },
    ]);

    expect(ts).toContain("content: Block[];");
    expect(ts.match(/\$locale: Locale;/g)).toHaveLength(2);
    expect(ts).not.toContain('$locale: "en" | "de";');
  });

  it("generateApplicationIntegrationTypes keeps localized content unions free of raw $locale enum members", () => {
    const ts = generateApplicationIntegrationTypes([
      {
        name: "posts",
        displayName: "Posts",
        schema: {
          title: PropertyType.STRING,
          $content: PropertyType.NULL,
          $locale: [PropertyType.ENUM, ["en", "de"]],
        },
        inflowSchemas: [
          {
            title: PropertyType.STRING,
            $content: PropertyType.NULL,
            $locale: [PropertyType.ENUM, ["en", "de"]],
          },
          {
            title: PropertyType.STRING,
            category: PropertyType.STRING,
            $content: PropertyType.NULL,
            $locale: [PropertyType.ENUM, ["en", "de"]],
          },
        ],
        i18n: { localized: true, locales: ["en", "de"] },
      },
    ]);

    expect(ts).toContain("posts:");
    expect(ts).toContain("$locale: Locale;");
    expect(ts).not.toContain('$locale: "en" | "de";');
  });
});

describe("generateTypeScript with merged enum schemas", () => {
  it("emits union of all values when two ENUM schemas are merged before generation", () => {
    const schemaA: CollectionSchema = {
      status: [PropertyType.ENUM | PropertyType.NULL, ["draft", "published"]],
    };
    const schemaB: CollectionSchema = {
      status: [PropertyType.ENUM | PropertyType.NULL, ["active", "inactive"]],
    };

    // Simulate what broadcastSchemaChanges does: merge per-property
    const merged: CollectionSchema = {};
    for (const [prop, value] of Object.entries(schemaA)) {
      merged[prop] = mergeSchemaValues(merged[prop] ?? 0, value);
    }
    for (const [prop, value] of Object.entries(schemaB)) {
      merged[prop] = mergeSchemaValues(merged[prop] ?? 0, value);
    }

    const ts = generateTypeScript([{ name: "posts", displayName: "Posts", schema: merged }]);
    expect(ts).toContain(`status: "draft" | "published" | "active" | "inactive"`);
  });
});

describe("schemaType", () => {
  it("returns number as-is", () => {
    expect(schemaType(PropertyType.STRING)).toBe(PropertyType.STRING);
    expect(schemaType(0)).toBe(0);
  });

  it("extracts number from tuple", () => {
    expect(schemaType([PropertyType.ENUM, ["a", "b"]])).toBe(PropertyType.ENUM);
  });
});

describe("schemaEnumValues", () => {
  it("returns undefined for plain number", () => {
    expect(schemaEnumValues(PropertyType.STRING)).toBeUndefined();
  });

  it("returns array from tuple", () => {
    expect(schemaEnumValues([PropertyType.ENUM, ["x", "y"]])).toEqual(["x", "y"]);
  });
});

describe("mergeSchemaValues", () => {
  it("ORs two plain numbers", () => {
    expect(mergeSchemaValues(PropertyType.ENUM, PropertyType.NULL)).toBe(
      PropertyType.ENUM | PropertyType.NULL,
    );
  });

  it("merges a number with a tuple — produces tuple", () => {
    const result = mergeSchemaValues(0, [PropertyType.ENUM, ["a", "b"]]);
    expect(Array.isArray(result)).toBe(true);
    expect(schemaType(result)).toBe(PropertyType.ENUM);
    expect(schemaEnumValues(result)).toEqual(["a", "b"]);
  });

  it("unions enum values from two tuples", () => {
    const result = mergeSchemaValues(
      [PropertyType.ENUM, ["a", "b"]],
      [PropertyType.ENUM, ["b", "c"]],
    );
    expect(Array.isArray(result)).toBe(true);
    expect(schemaEnumValues(result)).toEqual(["a", "b", "c"]);
  });

  it("ORs types when merging tuples", () => {
    const result = mergeSchemaValues([PropertyType.ENUM, ["a"]], [PropertyType.NULL, []]);
    expect(schemaType(result)).toBe(PropertyType.ENUM | PropertyType.NULL);
  });
});
