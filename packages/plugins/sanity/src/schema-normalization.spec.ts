import { describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import { buildSanitySchemaSyncPayload, buildSanitySchemaSyncResult } from "./schema-normalization";

describe("Sanity schema normalization", () => {
  test("derives conservative Contfu schemas from Sanity schemaTypes", () => {
    expect(
      buildSanitySchemaSyncPayload("production", [
        {
          name: "post",
          type: "document",
          fields: [
            { name: "title", type: "string", validation: (rule: any) => rule.required() },
            { name: "slug", type: "slug" },
            {
              name: "publishedAt",
              type: "datetime",
              validation: (rule: any) => rule.required(),
            },
            { name: "publishDate", type: "date" },
            { name: "image", type: "image" },
            { name: "location", type: "geopoint" },
            { name: "accent", type: "color" },
            { name: "metadata", type: "object", validation: (rule: any) => rule.required() },
            { name: "settings", type: "object" },
            { name: "seo", type: "seo" },
            { name: "requiredSeo", type: "seo", validation: (rule: any) => rule.required() },
            { name: "sections", type: "array", of: [{ type: "object" }] },
            {
              name: "callouts",
              type: "array",
              of: [{ type: "callout" }],
              validation: (rule: any) => rule.required(),
            },
            { name: "scores", type: "array", of: [{ type: "number" }] },
            { name: "assets", type: "array", of: [{ type: "image" }] },
            { name: "unknownAlias", type: "unknownAlias" },
            { name: "unknownAliases", type: "array", of: [{ type: "unknownAlias" }] },
            { name: "body", type: "array", of: [{ type: "block" }] },
            {
              name: "authors",
              type: "array",
              of: [{ type: "reference", to: [{ type: "author" }] }],
            },
          ],
        },
        {
          name: "seo",
          type: "object",
          fields: [{ name: "description", type: "string" }],
        },
        {
          name: "callout",
          type: "object",
          fields: [{ name: "title", type: "string" }],
        },
        {
          name: "unknownAlias",
          type: "string",
          fields: [],
        },
      ] as never),
    ).toEqual({
      dataset: "production",
      environment: "production",
      refTargets: { post: { authors: ["author"] } },
      schemas: {
        post: {
          $draft: PropertyType.BOOLEAN,
          title: PropertyType.STRING,
          slug: PropertyType.STRING | PropertyType.OPTIONAL,
          publishedAt: PropertyType.DATE,
          publishDate: PropertyType.PLAINDATE | PropertyType.OPTIONAL,
          image: PropertyType.FILE | PropertyType.OPTIONAL,
          location: PropertyType.GEOPOINT | PropertyType.OPTIONAL,
          accent: PropertyType.COLOR | PropertyType.OPTIONAL,
          metadata: PropertyType.OBJECT,
          settings: PropertyType.OBJECT | PropertyType.OPTIONAL,
          seo: PropertyType.OBJECT | PropertyType.OPTIONAL,
          requiredSeo: PropertyType.OBJECT,
          sections: PropertyType.OBJECT | PropertyType.OPTIONAL,
          callouts: PropertyType.OBJECT,
          scores: PropertyType.NUMBERS | PropertyType.OPTIONAL,
          assets: PropertyType.FILES | PropertyType.OPTIONAL,
          unknownAlias: PropertyType.STRING | PropertyType.OPTIONAL,
          unknownAliases: PropertyType.STRINGS | PropertyType.OPTIONAL,
          body: PropertyType.BLOCK | PropertyType.OPTIONAL,
          authors: PropertyType.REFS | PropertyType.OPTIONAL,
        },
      },
    });
  });

  test("resolves named aliases and omits unknown or mixed array types with diagnostics", () => {
    const result = buildSanitySchemaSyncResult("production", [
      {
        name: "post",
        type: "document",
        fields: [
          { name: "headline", type: "shortText" },
          { name: "requiredHeadline", type: "requiredText" },
          { name: "headlines", type: "array", of: [{ type: "shortText" }] },
          { name: "dates", type: "array", of: [{ type: "date" }] },
          { name: "customUnknown", type: "opaqueInput" },
          { name: "mixed", type: "array", of: [{ type: "string" }, { type: "number" }] },
          { name: "unknownMembers", type: "array", of: [{ type: "notDefined" }] },
        ],
      },
      { name: "shortText", type: "string" },
      { name: "requiredText", type: "string", validation: (rule: any) => rule.required() },
    ] as never);

    expect(result.payload.schemas.post).toEqual({
      $draft: PropertyType.BOOLEAN,
      headline: PropertyType.STRING | PropertyType.OPTIONAL,
      requiredHeadline: PropertyType.STRING,
      headlines: PropertyType.STRINGS | PropertyType.OPTIONAL,
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: "customUnknown", code: "unsupported_field_type" }),
        expect.objectContaining({ fieldPath: "mixed", code: "ambiguous_array_members" }),
        expect.objectContaining({ fieldPath: "dates[0]", code: "unsupported_array_member" }),
        expect.objectContaining({ fieldPath: "unknownMembers[0]", code: "unsupported_field_type" }),
      ]),
    );
  });

  test("maps Portable Text arrays with inline objects and images to block", () => {
    const result = buildSanitySchemaSyncResult("production", [
      {
        name: "post",
        type: "document",
        fields: [
          {
            name: "body",
            type: "array",
            of: [{ type: "block" }, { type: "inlineLink" }, { type: "image" }],
          },
        ],
      },
      { name: "inlineLink", type: "object", fields: [{ name: "href", type: "url" }] },
    ] as never);

    expect(result.payload.schemas.post).toEqual({
      $draft: PropertyType.BOOLEAN,
      body: PropertyType.BLOCK | PropertyType.OPTIONAL,
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ fieldPath: "body", code: "ambiguous_array_members" }),
    );
  });

  test("maps required fields but diagnoses unsupported validation rules and callbacks", () => {
    const result = buildSanitySchemaSyncResult("production", [
      {
        name: "post",
        type: "document",
        fields: [
          {
            name: "title",
            type: "string",
            validation: (rule: any) =>
              rule
                .required()
                .min(3)
                .max(80)
                .custom(() => true),
          },
          { name: "opaque", type: "string", validation: (rule: any) => rule.unknownRule() },
          {
            name: "conflictingPresence",
            type: "string",
            validation: (rule: any) => rule.required().optional(),
          },
          {
            name: "contextual",
            type: "string",
            validation: (rule: any, context: any = {}) =>
              context.document ? rule.required() : rule,
          },
          {
            name: "throws",
            type: "string",
            validation: (rule: any) => {
              rule.required();
              throw new Error("runtime context unavailable");
            },
          },
          {
            name: "async",
            type: "string",
            validation: (rule: any) => Promise.resolve(rule.required()),
          },
        ],
      },
    ] as never);

    expect(result.payload.schemas.post).toEqual({
      $draft: PropertyType.BOOLEAN,
      title: PropertyType.STRING,
      opaque: PropertyType.STRING | PropertyType.OPTIONAL,
      conflictingPresence: PropertyType.STRING | PropertyType.OPTIONAL,
      contextual: PropertyType.STRING | PropertyType.OPTIONAL,
      throws: PropertyType.STRING | PropertyType.OPTIONAL,
      async: PropertyType.STRING | PropertyType.OPTIONAL,
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "title",
          code: "unsupported_validation",
          rule: "min",
        }),
        expect.objectContaining({
          fieldPath: "title",
          code: "unsupported_validation",
          rule: "max",
        }),
        expect.objectContaining({ fieldPath: "title", code: "custom_validation", rule: "custom" }),
        expect.objectContaining({ fieldPath: "opaque", code: "unevaluable_validation" }),
        expect.objectContaining({
          fieldPath: "conflictingPresence",
          code: "unevaluable_validation",
        }),
        expect.objectContaining({ fieldPath: "contextual", code: "unevaluable_validation" }),
        expect.objectContaining({ fieldPath: "throws", code: "unevaluable_validation" }),
        expect.objectContaining({ fieldPath: "async", code: "unevaluable_validation" }),
      ]),
    );
  });

  test("diagnoses required array members and nested object constraints without exposing editor options", () => {
    const result = buildSanitySchemaSyncResult("production", [
      {
        name: "post",
        type: "document",
        fields: [
          { name: "metadata", type: "metadataType" },
          {
            name: "tags",
            type: "array",
            of: [{ type: "string", validation: (rule: any) => rule.required() }],
          },
          {
            name: "authors",
            type: "array",
            of: [{ type: "reference", to: [{ type: "author" }] }],
          },
          {
            name: "editorOnly",
            type: "string",
            hidden: true,
            readOnly: true,
            components: { input: () => null },
          },
        ],
      },
      {
        name: "metadataType",
        type: "object",
        fields: [
          { name: "label", type: "string", validation: (rule: any) => rule.required().min(2) },
        ],
      },
    ] as never);

    expect(result.payload.schemas.post).toEqual({
      $draft: PropertyType.BOOLEAN,
      metadata: PropertyType.OBJECT | PropertyType.OPTIONAL,
      tags: PropertyType.STRINGS | PropertyType.OPTIONAL,
      authors: PropertyType.REFS | PropertyType.OPTIONAL,
      editorOnly: PropertyType.STRING | PropertyType.OPTIONAL,
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "metadata.label",
          code: "unsupported_validation",
          rule: "required",
        }),
        expect.objectContaining({
          fieldPath: "metadata.label",
          code: "unsupported_validation",
          rule: "min",
        }),
        expect.objectContaining({
          fieldPath: "tags[0]",
          code: "unsupported_validation",
          rule: "required",
        }),
        expect.objectContaining({
          fieldPath: "editorOnly",
          code: "unsupported_input_semantics",
          rule: "hidden",
        }),
        expect.objectContaining({
          fieldPath: "editorOnly",
          code: "unsupported_input_semantics",
          rule: "readOnly",
        }),
        expect.objectContaining({
          fieldPath: "editorOnly",
          code: "unsupported_input_semantics",
          rule: "components.input",
        }),
      ]),
    );
    expect(result.payload).not.toHaveProperty("diagnostics");
  });
});

test("publishes typed crossDatasetReference destinations even before the target dataset is synced", async () => {
  const { decodeRefTarget } = await import("@contfu/core");
  const { payload, diagnostics } = buildSanitySchemaSyncResult("A", [
    { name: "personLink", type: "crossDatasetReference", dataset: "B", to: [{ type: "person" }] },
    {
      name: "post",
      type: "document",
      fields: [
        { name: "author", type: "personLink" },
        { name: "authors", type: "array", of: [{ type: "personLink" }] },
      ],
    },
  ]);
  expect(payload.schemas.post).toMatchObject({
    author: PropertyType.REF | PropertyType.OPTIONAL,
    authors: PropertyType.REFS | PropertyType.OPTIONAL,
  });
  expect(payload.refTargets?.post?.author?.map(decodeRefTarget)).toEqual([
    { scope: "B", collection: "person" },
  ]);
  expect(payload.refTargets?.post?.authors).toEqual(payload.refTargets?.post?.author);
  expect(diagnostics).toEqual([]);
});

for (const projectId of ["local-project", undefined]) {
  test(`publishes foreign-project REF/REFS declarations with source project ${projectId ?? "unknown"}`, async () => {
    const { payload, diagnostics } = buildSanitySchemaSyncResult(
      "A",
      [
        {
          name: "foreignLink",
          type: "crossDatasetReference",
          projectId: "foreign-project",
          dataset: "B",
          to: [{ type: "person" }],
        },
        {
          name: "post",
          type: "document",
          fields: [
            { name: "author", type: "foreignLink" },
            { name: "authors", type: "array", of: [{ type: "foreignLink" }] },
            {
              name: "mixed",
              type: "array",
              of: [{ type: "reference", to: [{ type: "person" }] }, { type: "foreignLink" }],
            },
            {
              name: "direct",
              type: "crossDatasetReference",
              projectId: "foreign-project",
              dataset: "A",
              to: [{ type: "person" }],
            },
          ],
        },
      ],
      projectId,
    );
    const { decodeRefTarget } = await import("@contfu/core");
    expect(payload.schemas.post).toMatchObject({
      author: PropertyType.REF | PropertyType.OPTIONAL,
      authors: PropertyType.REFS | PropertyType.OPTIONAL,
      mixed: PropertyType.REFS | PropertyType.OPTIONAL,
      direct: PropertyType.REF | PropertyType.OPTIONAL,
    });
    expect(payload.refTargets?.post?.author?.map(decodeRefTarget)).toEqual([
      { connection: "foreign-project", scope: "B", collection: "person" },
    ]);
    expect(payload.refTargets?.post?.authors).toEqual(payload.refTargets?.post?.author);
    expect(payload.refTargets?.post?.mixed).toHaveLength(2);
    expect(diagnostics).toEqual([]);
  });
}

test("accepts explicit same-project declarations and project overrides on reference aliases", () => {
  const { payload, diagnostics } = buildSanitySchemaSyncResult(
    "A",
    [
      {
        name: "link",
        type: "crossDatasetReference",
        projectId: "foreign-project",
        dataset: "B",
        to: [{ type: "person" }],
      },
      {
        name: "post",
        type: "document",
        fields: [
          { name: "author", type: "link", projectId: "local-project" },
          {
            name: "authors",
            type: "array",
            of: [{ type: "link", projectId: "local-project" }],
          },
        ],
      },
    ],
    "local-project",
  );
  expect(payload.schemas.post).toMatchObject({
    author: PropertyType.REF | PropertyType.OPTIONAL,
    authors: PropertyType.REFS | PropertyType.OPTIONAL,
  });
  expect(payload.refTargets?.post?.author).toHaveLength(1);
  expect(payload.refTargets?.post?.authors).toEqual(payload.refTargets?.post?.author);
  expect(diagnostics).toEqual([]);
});

test("publishes all multi-to destinations for local and cross-scope REF/REFS", async () => {
  const { decodeRefTarget } = await import("@contfu/core");
  const { payload, diagnostics } = buildSanitySchemaSyncResult("A", [
    {
      name: "post",
      type: "document",
      fields: [
        { name: "featured", type: "reference", to: [{ type: "article" }, { type: "person" }] },
        {
          name: "related",
          type: "array",
          of: [{ type: "reference", to: [{ type: "article" }, { type: "person" }] }],
        },
        {
          name: "remote",
          type: "crossDatasetReference",
          dataset: "B",
          to: [{ type: "article" }, { type: "person" }],
        },
        {
          name: "remotes",
          type: "array",
          of: [
            {
              type: "crossDatasetReference",
              dataset: "B",
              to: [{ type: "article" }, { type: "person" }],
            },
          ],
        },
      ],
    },
  ]);
  expect(payload.refTargets?.post?.featured).toEqual(["article", "person"]);
  expect(payload.refTargets?.post?.related).toEqual(["article", "person"]);
  expect(payload.refTargets?.post?.remote?.map(decodeRefTarget)).toEqual([
    { scope: "B", collection: "article" },
    { scope: "B", collection: "person" },
  ]);
  expect(payload.refTargets?.post?.remotes).toEqual(payload.refTargets?.post?.remote);
  expect(diagnostics).toEqual([]);
});

test("publishes global document reference resource identities without service setup state", async () => {
  const { decodeRefTarget } = await import("@contfu/core");
  const { payload, diagnostics } = buildSanitySchemaSyncResult(
    "A",
    [
      {
        name: "post",
        type: "document",
        fields: [
          {
            name: "person",
            type: "globalDocumentReference",
            resourceType: "dataset",
            resourceId: "Q.B",
            to: [{ type: "person" }],
          },
        ],
      },
    ],
    "P",
  );
  expect(payload.schemas.post.person).toBe(PropertyType.REF | PropertyType.OPTIONAL);
  expect(payload.refTargets?.post?.person?.map(decodeRefTarget)).toEqual([
    { connection: "Q", scope: "B", collection: "person" },
  ]);
  expect(diagnostics).toEqual([]);
});
