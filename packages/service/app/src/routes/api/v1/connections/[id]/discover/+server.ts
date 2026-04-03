import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { ConnectionType, type CollectionIcon } from "@contfu/core";
import type { DiscoveredCollection } from "@contfu/svc-core";
import { getConnectionWithCredentials } from "@contfu/svc-backend/features/connections/getConnectionWithCredentials";
import { listCollectionsByConnection } from "@contfu/svc-backend/features/collections/listCollectionsByConnection";
import { iterateDataSources, extractNotionIcon } from "@contfu/svc-sources/notion";
import { iterateContentTypes } from "@contfu/svc-sources/strapi";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const connectionId = Number(params.id);

  const connection = await runWithUser(userId, getConnectionWithCredentials(connectionId));
  if (!connection) return json({ message: "Connection not found" }, { status: 404 });

  const credentials = connection.credentials?.toString("utf-8") ?? "";
  if (!credentials) return json([]);

  if (connection.type !== ConnectionType.NOTION && connection.type !== ConnectionType.STRAPI)
    return json([]);

  const existing = await runWithUser(userId, listCollectionsByConnection(connectionId));
  const importedRefs = new Set(existing.map((c) => c.refString).filter(Boolean));

  const discovered: DiscoveredCollection[] = [];

  if (connection.type === ConnectionType.NOTION) {
    for await (const ds of iterateDataSources(credentials)) {
      const titleParts = (ds as { title?: Array<{ plain_text?: string }> }).title ?? [];
      const displayName = titleParts.map((t) => t.plain_text ?? "").join("") || "Untitled";
      discovered.push({
        ref: ds.id,
        displayName,
        alreadyImported: importedRefs.has(ds.id),
        icon: extractNotionIcon(ds) as CollectionIcon | undefined,
      });
    }
  } else if (connection.type === ConnectionType.STRAPI) {
    const url = connection.url ?? "";
    for await (const ct of iterateContentTypes(url, credentials)) {
      discovered.push({
        ref: ct.uid,
        displayName: ct.info.displayName,
        alreadyImported: importedRefs.has(ct.uid),
      });
    }
  }

  return json(discovered);
}
