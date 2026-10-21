import { afterEach, describe, expect, test } from "bun:test";
import { PropertyType } from "@contfu/core";
import { updateContfuSchema } from "./schema-sync";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.CONTFU_ORIGIN;
});

describe("updateContfuSchema", () => {
  test("posts the normalized schema with bearer auth", async () => {
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
        post: { $draft: PropertyType.BOOLEAN, title: PropertyType.STRING | PropertyType.OPTIONAL },
      },
    });
  });

  test("reports diagnostics without changing the posted wire payload", async () => {
    let posted: unknown;
    const diagnostics: unknown[] = [];
    globalThis.fetch = ((_url: string | URL, init?: RequestInit) => {
      posted = JSON.parse(init?.body as string);
      return Promise.resolve(new Response("ok", { status: 200 }));
    }) as typeof fetch;

    await updateContfuSchema({
      webhookSecret: "secret-webhook-secret",
      dataset: "production",
      schemaTypes: [
        {
          name: "post",
          type: "document",
          fields: [{ name: "unknown", type: "customInput" }],
        },
      ] as never,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(posted).toEqual({
      dataset: "production",
      environment: "production",
      schemas: { post: { $draft: PropertyType.BOOLEAN } },
    });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        document: "post",
        fieldPath: "unknown",
        code: "unsupported_field_type",
        sourceType: "customInput",
      }),
    ]);
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
});

test("uses the source project to qualify targets before posting without serializing project setup", async () => {
  let posted: Record<string, unknown> | undefined;
  const diagnostics: unknown[] = [];
  globalThis.fetch = ((_url: string | URL, init?: RequestInit) => {
    posted = JSON.parse(init?.body as string);
    return Promise.resolve(new Response("ok", { status: 200 }));
  }) as typeof fetch;
  await updateContfuSchema({
    webhookSecret: "secret",
    dataset: "A",
    projectId: "local-project",
    schemaTypes: [
      {
        name: "post",
        type: "document",
        fields: [
          {
            name: "author",
            type: "crossDatasetReference",
            projectId: "local-project",
            dataset: "B",
            to: [{ type: "person" }],
          },
          {
            name: "foreign",
            type: "crossDatasetReference",
            projectId: "foreign-project",
            dataset: "B",
            to: [{ type: "person" }],
          },
        ],
      },
    ],
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  expect(posted?.schemas).toEqual({
    post: {
      $draft: PropertyType.BOOLEAN,
      author: PropertyType.REF | PropertyType.OPTIONAL,
      foreign: PropertyType.REF | PropertyType.OPTIONAL,
    },
  });
  expect(posted?.refTargets).toEqual({
    post: { author: [expect.any(String)], foreign: [expect.any(String)] },
  });
  expect(posted).not.toHaveProperty("projectId");
  expect(posted).not.toHaveProperty("diagnostics");
  expect(diagnostics).toEqual([]);
});
