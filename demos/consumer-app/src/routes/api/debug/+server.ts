import type { RequestHandler } from "./$types";
import { getAllArticles, getArticleCount } from "$lib/state.svelte.js";
import { startSyncConnection, getSyncStatus } from "$lib/sync.js";

/**
 * Debug endpoint to check sync state and trigger connection.
 * GET /api/debug - returns current state
 * POST /api/debug - triggers sync connection
 */

export const GET: RequestHandler = async () => {
  const state = {
    syncStatus: getSyncStatus(),
    articleCount: getArticleCount(),
    articles: getAllArticles().map((a) => ({ id: a.id, title: a.title, slug: a.slug })),
  };

  return new Response(JSON.stringify(state, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: RequestHandler = async () => {
  console.log("[DEBUG] Triggering sync connection...");

  try {
    await startSyncConnection();
    return new Response(JSON.stringify({ success: true, message: "Sync connection triggered" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[DEBUG] Sync connection error:", errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
