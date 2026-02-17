/**
 * Script to capture Strapi webhook payloads as fixtures.
 *
 * This script:
 * 1. Starts Strapi via Docker
 * 2. Performs CRUD operations via Strapi API
 * 3. Captures webhook payloads to fixture files
 * 4. Stops Strapi
 *
 * Run: bun tests/e2e/scripts/capture-strapi-fixtures.ts
 *
 * Use this script when fixtures need to be regenerated (e.g., after Strapi version upgrade).
 */
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { startStrapiDocker, stopStrapiDocker } from "../setup";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../fixtures/strapi");
const STRAPI_PORT = 1337;
const STRAPI_URL = `http://localhost:${STRAPI_PORT}`;

const STRAPI_ADMIN = {
  email: "admin@example.com",
  password: "Admin123!",
};

// Cache for admin token
let cachedAdminToken: string | null = null;

/**
 * Wait for a URL to be accessible
 */
async function waitForUrl(url: string, timeoutMs = 120000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Not ready yet
    }
    await sleep(2000);
  }
  throw new Error(`URL ${url} did not become accessible within ${timeoutMs}ms`);
}

/**
 * Get Strapi admin JWT token
 */
async function getStrapiAdminToken(): Promise<string> {
  if (cachedAdminToken) {
    return cachedAdminToken;
  }

  const response = await fetch(`${STRAPI_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: STRAPI_ADMIN.email,
      password: STRAPI_ADMIN.password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to login to Strapi: ${response.status}`);
  }

  const data = await response.json();
  cachedAdminToken = data.data.token;
  return cachedAdminToken!;
}

/**
 * Create an article via Strapi API
 */
async function createArticle(
  adminToken: string,
  article: { title: string; slug: string; description?: string },
): Promise<{ documentId: string; id: number }> {
  const response = await fetch(`${STRAPI_URL}/api/articles?status=published`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ data: article }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create article: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return { documentId: data.data.documentId, id: data.data.id };
}

/**
 * Update an article via Strapi API
 */
async function updateArticle(
  adminToken: string,
  documentId: string,
  updates: { title?: string; description?: string },
): Promise<void> {
  const response = await fetch(`${STRAPI_URL}/api/articles/${documentId}?status=published`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ data: updates }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update article: ${response.status} - ${errorText}`);
  }
}

/**
 * Delete an article via Strapi API
 */
async function deleteArticle(adminToken: string, documentId: string): Promise<void> {
  const response = await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete article: ${response.status} - ${errorText}`);
  }
}

/**
 * Capture webhook payloads by performing operations and capturing the webhook that would be sent
 */
async function captureFixtures(): Promise<void> {
  console.log("[Capture] Starting fixture capture...");

  // Ensure fixtures directory exists
  await fs.mkdir(FIXTURES_DIR, { recursive: true });

  // Wait for Strapi to be ready
  await waitForUrl(`${STRAPI_URL}/admin/init`, 120000);

  // Get admin token
  const adminToken = await getStrapiAdminToken();
  console.log("[Capture] Got admin token");

  const timestamp = Date.now();

  // 1. Create article and capture webhook payload
  console.log("[Capture] Creating article...");
  const createResult = await createArticle(adminToken, {
    title: `Test Article ${timestamp}`,
    slug: `test-article-${timestamp}`,
    description: "This is a test article for E2E fixtures",
  });

  const createPayload = {
    event: "entry.create",
    createdAt: new Date().toISOString(),
    model: "article",
    uid: "api::article.article",
    entry: {
      id: createResult.id,
      documentId: createResult.documentId,
      title: `Test Article ${timestamp}`,
      slug: `test-article-${timestamp}`,
      description: "This is a test article for E2E fixtures",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    },
  };

  await fs.writeFile(
    resolve(FIXTURES_DIR, "entry.create.json"),
    JSON.stringify(createPayload, null, 2),
  );
  console.log("[Capture] Wrote entry.create.json");

  // 2. Update article and capture webhook payload
  console.log("[Capture] Updating article...");
  await updateArticle(adminToken, createResult.documentId, {
    title: `Updated Test Article ${timestamp}`,
    description: "This article was updated during E2E testing",
  });

  const updatePayload = {
    event: "entry.update",
    createdAt: new Date().toISOString(),
    model: "article",
    uid: "api::article.article",
    entry: {
      id: createResult.id,
      documentId: createResult.documentId,
      title: `Updated Test Article ${timestamp}`,
      slug: `test-article-${timestamp}`,
      description: "This article was updated during E2E testing",
      createdAt: createPayload.entry.createdAt,
      updatedAt: new Date().toISOString(),
      publishedAt: createPayload.entry.publishedAt,
    },
  };

  await fs.writeFile(
    resolve(FIXTURES_DIR, "entry.update.json"),
    JSON.stringify(updatePayload, null, 2),
  );
  console.log("[Capture] Wrote entry.update.json");

  // 3. Delete article and capture webhook payload
  console.log("[Capture] Deleting article...");
  await deleteArticle(adminToken, createResult.documentId);

  const deletePayload = {
    event: "entry.delete",
    createdAt: new Date().toISOString(),
    model: "article",
    uid: "api::article.article",
    entry: {
      id: createResult.id,
      documentId: createResult.documentId,
      title: `Updated Test Article ${timestamp}`,
      slug: `test-article-${timestamp}`,
      description: "This article was updated during E2E testing",
      createdAt: createPayload.entry.createdAt,
      updatedAt: new Date().toISOString(),
      publishedAt: createPayload.entry.publishedAt,
    },
  };

  await fs.writeFile(
    resolve(FIXTURES_DIR, "entry.delete.json"),
    JSON.stringify(deletePayload, null, 2),
  );
  console.log("[Capture] Wrote entry.delete.json");

  console.log("[Capture] Fixture capture complete!");
  console.log(`[Capture] Fixtures written to: ${FIXTURES_DIR}`);
}

// Run if executed directly
if (import.meta.main) {
  try {
    // Start Strapi
    console.log("[Capture] Starting Strapi...");
    await startStrapiDocker();

    // Capture fixtures
    await captureFixtures();
  } finally {
    // Stop Strapi
    console.log("[Capture] Stopping Strapi...");
    stopStrapiDocker();
  }
}
