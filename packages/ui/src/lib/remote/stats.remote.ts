import { query } from "$app/server";
import { fetchFromServer } from "$lib/server/proxy";
import * as v from "valibot";

const syncStatusSchema = v.object({
  state: v.picklist(["disabled", "connecting", "syncing", "connected", "error"]),
  reason: v.nullable(v.string()),
});

const statsSchema = v.object({
  itemCount: v.number(),
  collectionCount: v.number(),
  fileCount: v.number(),
  downloadedCount: v.number(),
  processedCount: v.number(),
  sync: syncStatusSchema,
});

export const getStats = query(async () => {
  const response = await fetchFromServer("/api/status");
  if (!response.ok) {
    throw new Error(`Failed to load status: ${response.status} ${response.statusText}`);
  }

  return v.parse(statsSchema, await response.json());
});
