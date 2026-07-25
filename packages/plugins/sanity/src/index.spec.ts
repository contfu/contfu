import { afterEach, describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import { buildSanitySchemaSyncPayload, updateContfuSchema, updateConftuSchema } from "./index";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.CONTFU_ORIGIN;
});

describe("@contfu/sanity", () => {
  test("posts Contfu schemas with bearer auth", async () => {
    let calledUrl = "";
    let calledInit: RequestInit | undefined;
    globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
      calledUrl = String(url);
      calledInit = init;
      return Promise.resolve(new Response("ok", { status: 200 }));
    }) as typeof fetch;

    const response = await updateContfuSchema({
      webhookSecret: "secret-webhook-secret",
      dataset: "production",
      schemaTypes: [
        {
          name: "post",
          type: "document",
          fields: [{ name: "title", type: "string" }],
        },
      ] as never,
    });

    expect(response.status).toBe(200);
    expect(calledUrl).toBe("https://contfu.com/webhooks/sanity/schema");
    expect(calledInit?.method).toBe("POST");
    expect(calledInit?.headers).toMatchObject({
      "content-type": "application/json",
      Authorization: "Bearer secret-webhook-secret",
    });
    expect(JSON.parse(calledInit?.body as string)).toEqual({
      dataset: "production",
      environment: "production",
      schemas: {
        post: { $draft: PropertyType.BOOLEAN, title: PropertyType.STRING | PropertyType.NULL },
      },
    });
  });

  test("keeps the deprecated Conftu-typo export as an alias", () => {
    expect(updateConftuSchema).toBe(updateContfuSchema);
  });

  test("supports overriding Contfu origin for development", async () => {
    let calledUrl = "";
    globalThis.fetch = ((url: string | URL) => {
      calledUrl = String(url);
      return Promise.resolve(new Response("ok", { status: 200 }));
    }) as typeof fetch;
    process.env.CONTFU_ORIGIN = "http://localhost:4173/";

    await updateContfuSchema({
      webhookSecret: "secret-webhook-secret",
      dataset: "production",
      schemaTypes: [],
    });

    expect(calledUrl).toBe("http://localhost:4173/webhooks/sanity/schema");
  });

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
            { name: "image", type: "image" },
            { name: "location", type: "geopoint" },
            { name: "accent", type: "color" },
            { name: "metadata", type: "object", validation: (rule: any) => rule.required() },
            { name: "settings", type: "object" },
            { name: "sections", type: "array", of: [{ type: "object" }] },
            {
              name: "callouts",
              type: "array",
              of: [{ type: "callout" }],
              validation: (rule: any) => rule.required(),
            },
            { name: "scores", type: "array", of: [{ type: "number" }] },
            { name: "assets", type: "array", of: [{ type: "image" }] },
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
      schemas: {
        post: {
          $draft: PropertyType.BOOLEAN,
          title: PropertyType.STRING,
          slug: PropertyType.STRING | PropertyType.NULL,
          publishedAt: PropertyType.DATE,
          image: PropertyType.FILE | PropertyType.NULL,
          location: PropertyType.GEOPOINT | PropertyType.NULL,
          accent: PropertyType.COLOR | PropertyType.NULL,
          metadata: PropertyType.JSON,
          settings: PropertyType.JSON | PropertyType.NULL,
          sections: PropertyType.JSON | PropertyType.NULL,
          callouts: PropertyType.JSON,
          scores: PropertyType.NUMBERS | PropertyType.NULL,
          assets: PropertyType.FILES | PropertyType.NULL,
          unknownAliases: PropertyType.STRINGS | PropertyType.NULL,
          body: PropertyType.BLOCK | PropertyType.NULL,
          authors: PropertyType.REFS | PropertyType.NULL,
        },
      },
    });
  });
});
