import { test, expect } from "../fixtures";
import crypto from "node:crypto";
import { SCHEMA_SYNC_UID, SCHEMA_BREAK_DS_ID, SCHEMA_FIX_DS_ID } from "./schema-sync.seed";

function computeHmacSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return hmac.digest("hex");
}

let webhookSecret: string;

test.describe.serial("Schema Sync via Notion Webhooks", () => {
  test("verification flow stores token", async ({ request }) => {
    const body = JSON.stringify({ verification_token: "schema-sync-secret" });
    const response = await request.post(`/webhooks/notion/${SCHEMA_SYNC_UID}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(200);
    webhookSecret = "schema-sync-secret";
  });

  test("schema change with removed property creates incident", async ({ request }) => {
    const payload = {
      type: "data_source.schema_updated",
      entity: { id: SCHEMA_BREAK_DS_ID, type: "data_source" },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    const response = await request.post(`/webhooks/notion/${SCHEMA_SYNC_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);
  });

  test("incidents page shows SchemaIncompatible incident", async ({ authenticatedPage: page }) => {
    await page.goto("/incidents");
    await page.waitForLoadState("networkidle");

    // The incident message from processSchemaChange includes "Schema change broke"
    await expect(page.getByText("Schema change broke")).toBeVisible({ timeout: 5000 });
    // Verify the broken filter property is mentioned
    await expect(page.getByText("status")).toBeVisible();
  });

  test("compatible schema change auto-resolves incidents", async ({ request }) => {
    const payload = {
      type: "data_source.schema_updated",
      entity: { id: SCHEMA_FIX_DS_ID, type: "data_source" },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    const response = await request.post(`/webhooks/notion/${SCHEMA_SYNC_UID}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);
  });

  test("incidents page shows no incidents after auto-resolve", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/incidents");
    await page.waitForLoadState("networkidle");

    // Empty state text from the incidents page
    await expect(page.getByText("no incidents")).toBeVisible({ timeout: 5000 });
  });
});
