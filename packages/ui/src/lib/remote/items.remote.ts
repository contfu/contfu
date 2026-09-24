import { query } from "$app/server";
import { fetchFromServer } from "../server/proxy";
import { isItemIdentity } from "@contfu/core";
import type { ItemData } from "@contfu/contfu";
import * as v from "valibot";
import { queryItemsInputSchema, queryItemsSearchParams } from "./query-items";

function normalizeItemData(raw: unknown): ItemData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const value = raw as Record<string, unknown>;
  if ("props" in value) {
    return value as unknown as ItemData;
  }

  if (!("$id" in value) || !("$collection" in value) || !("$changedAt" in value)) {
    return null;
  }

  const { $id, $collection, $changedAt, content, links, ...props } = value;

  return {
    id: isItemIdentity($id) ? $id[1] : Number($id),
    collection: String($collection),
    props,
    content: Array.isArray(content) ? content : undefined,
    changedAt: Number($changedAt),
    links: Array.isArray(links) ? links : [],
  };
}

export const getItemsQuery = query(queryItemsInputSchema, async (input) => {
  const params = queryItemsSearchParams(input, { includeCollection: true });

  const response = await fetchFromServer(`/api/query-items?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load items: ${response.status} ${response.statusText}`);
  }
  return response.json();
});

function itemResourcePath(encodedIdentity: string): string {
  const identity: unknown = JSON.parse(encodedIdentity);
  if (!isItemIdentity(identity)) throw new Error("Expected collection-scoped item identity");
  return `/api/collections/${encodeURIComponent(identity[0])}/items/${identity[1]}`;
}

export const getItemByIdQuery = query.batch(v.pipe(v.string(), v.minLength(1)), async (ids) => {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const response = await fetchFromServer(itemResourcePath(id));
      if (response.status === 404) return [id, null] as const;
      if (!response.ok) {
        throw new Error(`Failed to load item ${id}: ${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      return [id, normalizeItemData(payload.data)] as const;
    }),
  );

  const map = new Map(entries);
  return (id) => map.get(id) ?? null;
});

export const getItemFilesQuery = query(v.pipe(v.string(), v.minLength(1)), async (id) => {
  const response = await fetchFromServer(`${itemResourcePath(id)}/files`);
  if (!response.ok) {
    throw new Error(`Failed to load item files: ${response.status} ${response.statusText}`);
  }
  return response.json();
});
