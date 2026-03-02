import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { SOURCE_UID } from "./contentful-webhooks.seed";

function computeHmacSignature(body: string, secret: string, timestamp: string): string {
  const payload = `${timestamp}.${body}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

const MOCK_ENTRY_ID = "entry789xyz";
const MOCK_CONTENT_TYPE = "blogPost";

let webhookSecret: string;

test.describe("Contentful Webhooks", () => {
  test("verification flow stores secret", async ({ request }) => {
    const body = JSON.stringify({ verification_token: "test-webhook-secret" });
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(200);
    webhookSecret = "test-webhook-secret";
  });

  test("returns 404 for nonexistent source uid", async ({ request }) => {
    const body = JSON.stringify({ verification_token: "test" });
    const response = await request.post(
      "/webhooks/contentful/00000000-0000-0000-0000-000000000000",
      {
        data: body,
        headers: { "Content-Type": "application/json" },
      },
    );

    expect(response.status()).toBe(404);
  });

  test("Entry.publish broadcasts entry", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
        id: MOCK_ENTRY_ID,
        contentType: {
          sys: {
            id: MOCK_CONTENT_TYPE,
          },
        },
      },
      fields: {
        title: {
          "en-US": "Test Blog Post",
        },
        slug: {
          "en-US": "test-blog-post",
        },
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeHmacSignature(body, webhookSecret, timestamp);

    const startedAt = Date.now();
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": `ContentManagement.Entry.publish.${MOCK_CONTENT_TYPE}`,
        "X-Contentful-Signature": signature,
        "X-Contentful-Timestamp": timestamp,
      },
    });
    const durationMs = Date.now() - startedAt;

    expect(response.status()).toBe(200);
    expect(durationMs).toBeLessThan(1500);
  });

  test("Entry.unpublish broadcasts entry", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
        id: MOCK_ENTRY_ID,
        contentType: {
          sys: {
            id: MOCK_CONTENT_TYPE,
          },
        },
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeHmacSignature(body, webhookSecret, timestamp);

    const startedAt = Date.now();
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": `ContentManagement.Entry.unpublish.${MOCK_CONTENT_TYPE}`,
        "X-Contentful-Signature": signature,
        "X-Contentful-Timestamp": timestamp,
      },
    });
    const durationMs = Date.now() - startedAt;

    expect(response.status()).toBe(200);
    expect(durationMs).toBeLessThan(1500);
  });

  test("Entry.delete broadcasts entry", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
        id: MOCK_ENTRY_ID,
        contentType: {
          sys: {
            id: MOCK_CONTENT_TYPE,
          },
        },
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeHmacSignature(body, webhookSecret, timestamp);

    const startedAt = Date.now();
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": `ContentManagement.Entry.delete.${MOCK_CONTENT_TYPE}`,
        "X-Contentful-Signature": signature,
        "X-Contentful-Timestamp": timestamp,
      },
    });
    const durationMs = Date.now() - startedAt;

    expect(response.status()).toBe(200);
    expect(durationMs).toBeLessThan(1500);
  });

  test("rejects invalid HMAC signature with 401", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
        id: MOCK_ENTRY_ID,
        contentType: {
          sys: {
            id: MOCK_CONTENT_TYPE,
          },
        },
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const badSignature = computeHmacSignature(body, "wrong-secret", timestamp);

    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": `ContentManagement.Entry.publish.${MOCK_CONTENT_TYPE}`,
        "X-Contentful-Signature": badSignature,
        "X-Contentful-Timestamp": timestamp,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 400 for missing topic header", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
        id: MOCK_ENTRY_ID,
      },
    };
    const body = JSON.stringify(payload);

    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status()).toBe(400);
  });

  test("returns 400 for invalid JSON", async ({ request }) => {
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: Buffer.from("{invalid json"),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
  });

  test("handles Asset.publish", async ({ request }) => {
    const payload = {
      sys: {
        type: "Asset",
        id: "asset123",
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeHmacSignature(body, webhookSecret, timestamp);

    const startedAt = Date.now();
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": "ContentManagement.Asset.publish",
        "X-Contentful-Signature": signature,
        "X-Contentful-Timestamp": timestamp,
      },
    });
    const durationMs = Date.now() - startedAt;

    expect(response.status()).toBe(200);
    expect(durationMs).toBeLessThan(1500);
  });

  test("handles Asset.unpublish", async ({ request }) => {
    const payload = {
      sys: {
        type: "Asset",
        id: "asset123",
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeHmacSignature(body, webhookSecret, timestamp);

    const startedAt = Date.now();
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": "ContentManagement.Asset.unpublish",
        "X-Contentful-Signature": signature,
        "X-Contentful-Timestamp": timestamp,
      },
    });
    const durationMs = Date.now() - startedAt;

    expect(response.status()).toBe(200);
    expect(durationMs).toBeLessThan(1500);
  });

  test("handles Asset.delete", async ({ request }) => {
    const payload = {
      sys: {
        type: "Asset",
        id: "asset123",
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeHmacSignature(body, webhookSecret, timestamp);

    const startedAt = Date.now();
    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": "ContentManagement.Asset.delete",
        "X-Contentful-Signature": signature,
        "X-Contentful-Timestamp": timestamp,
      },
    });
    const durationMs = Date.now() - startedAt;

    expect(response.status()).toBe(200);
    expect(durationMs).toBeLessThan(1500);
  });

  test("returns 401 for missing signature", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
        id: MOCK_ENTRY_ID,
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": `ContentManagement.Entry.publish.${MOCK_CONTENT_TYPE}`,
        "X-Contentful-Timestamp": timestamp,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 401 for missing timestamp", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
        id: MOCK_ENTRY_ID,
      },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret, "12345");

    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": `ContentManagement.Entry.publish.${MOCK_CONTENT_TYPE}`,
        "X-Contentful-Signature": signature,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("returns 400 for missing entry ID", async ({ request }) => {
    const payload = {
      sys: {
        type: "Entry",
      },
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeHmacSignature(body, webhookSecret, timestamp);

    const response = await request.post(`/webhooks/contentful/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Contentful-Topic": `ContentManagement.Entry.publish.${MOCK_CONTENT_TYPE}`,
        "X-Contentful-Signature": signature,
        "X-Contentful-Timestamp": timestamp,
      },
    });

    expect(response.status()).toBe(400);
  });
});
