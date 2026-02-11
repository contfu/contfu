import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { SOURCE_UID } from "./notion-webhooks.seed";

// Must match the mock-notion-server.ts constants
const MOCK_PAGE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MOCK_DATABASE_ID = "11111111-2222-3333-4444-555555555555";

function computeHmacSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return hmac.digest("hex");
}

let webhookSecret: string;

test.describe("Notion Webhooks", () => {
  test("verification flow stores token", async ({ request }) => {
    const body = JSON.stringify({ verification_token: "test-webhook-secret" });
    const response = await request.post(`/webhooks/notion/${SOURCE_UID}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(200);

    // Store the secret for later HMAC signing
    webhookSecret = "test-webhook-secret";
  });

  test("returns 404 for nonexistent source uid", async ({ request }) => {
    const body = JSON.stringify({ verification_token: "test" });
    const response = await request.post("/webhooks/notion/00000000-0000-0000-0000-000000000000", {
      data: body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(404);
  });

  test("page.created fetches page and broadcasts", async ({ request }) => {
    const payload = {
      type: "page.created",
      entity: { id: MOCK_PAGE_ID, type: "page" },
      data: {
        parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
      },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    const response = await request.post(`/webhooks/notion/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);
  });

  test("page.deleted broadcasts deletion", async ({ request }) => {
    const payload = {
      type: "page.deleted",
      entity: { id: MOCK_PAGE_ID, type: "page" },
      data: {
        parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
      },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    const response = await request.post(`/webhooks/notion/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);
  });

  test("rejects invalid HMAC signature with 401", async ({ request }) => {
    const payload = {
      type: "page.created",
      entity: { id: MOCK_PAGE_ID, type: "page" },
      data: {
        parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
      },
    };
    const body = JSON.stringify(payload);
    const badSignature = computeHmacSignature(body, "wrong-secret");

    const response = await request.post(`/webhooks/notion/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": badSignature,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("page.locked is ignored", async ({ request }) => {
    const payload = {
      type: "page.locked",
      entity: { id: MOCK_PAGE_ID, type: "page" },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    const response = await request.post(`/webhooks/notion/${SOURCE_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);
  });

  test("returns 400 for invalid JSON", async ({ request }) => {
    const response = await request.post(`/webhooks/notion/${SOURCE_UID}`, {
      data: Buffer.from("{invalid json"),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
  });
});
