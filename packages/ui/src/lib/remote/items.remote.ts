import { query } from "$app/server";
import { fetchFromServer } from "../server/proxy";
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
    id: Number($id),
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

export const getItemByIdQuery = query.batch(v.pipe(v.string(), v.minLength(1)), async (ids) => {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const response = await fetchFromServer(`/api/items/${encodeURIComponent(id)}`);
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
  const response = await fetchFromServer(`/api/items/${encodeURIComponent(id)}/files`);
  if (!response.ok) {
    throw new Error(`Failed to load item files: ${response.status} ${response.statusText}`);
  }
  return response.json();
});
