import { describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateTypeScript,
  generateConsumerTypes,
  PropertyType,
  schemaType,
  schemaEnumValues,
  mergeSchemaValues,
  type CollectionSchema,
} from "./schemas";

/**
 * Write generated TS code + assertion lines to a temp file
 * and run tsc --noEmit to verify it compiles.
 */
async function assertCompiles(code: string, description?: string): Promise<void> {
  const file = join(tmpdir(), `contfu-type-check-${Date.now()}.ts`);
  await Bun.write(file, code);
  try {
    const proc = Bun.spawnSync([
      "npx",
      "tsc",
      "--noEmit",
      "--strict",
      "--target",
      "ESNext",
      "--moduleResolution",
      "bundler",
      file,
    ]);
    const stderr = proc.stderr.toString() + proc.stdout.toString();
    if (proc.exitCode !== 0) {
      throw new Error(`Type check failed${description ? ` (${description})` : ""}:\n${stderr}`);
    }
  } finally {
    (await Bun.file(file).exists()) && (await Bun.$`rm ${file}`.quiet());
  }
}

/** Expect tsc to fail on the given code (negative type test). */
async function assertDoesNotCompile(code: string): Promise<void> {
  const file = join(tmpdir(), `contfu-type-check-${Date.now()}.ts`);
  await Bun.write(file, code);
  try {
    const proc = Bun.spawnSync([
      "npx",
      "tsc",
      "--noEmit",
      "--strict",
      "--target",
      "ESNext",
      "--moduleResolution",
      "bundler",
      file,
    ]);
    if (proc.exitCode === 0) {
      throw new Error("Expected type check to fail, but it succeeded");
    }
  } finally {
    (await Bun.file(file).exists()) && (await Bun.$`rm ${file}`.quiet());
  }
}

describe("generateTypeScript", () => {
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

  it("generates string[] for REFS without refTargets", () => {
    const ts = generateTypeScript([
      { name: "blogPosts", displayName: "Blog Posts", schema: { tags: PropertyType.REFS } },
    ]);
    expect(ts).toContain("tags: string[];");
  });
});

describe("generateConsumerTypes", () => {
  it("uses self-referencing lookup for refTargets", () => {
    const ts = generateConsumerTypes([
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
    const ts = generateConsumerTypes([
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
    const ts = generateConsumerTypes([
      {
        name: "blogPosts",
        displayName: "Blog Posts",
        schema: { tags: PropertyType.REFS },
        refTargets: { tags: ["tags"] },
      },
    ]);
    expect(ts).toContain('tags: ContfuCollections["tags"][];');
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

  it("consumer types with refTargets compile with typed query client pattern", async () => {
    const generated = generateConsumerTypes([
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
