import { query } from "$app/server";
import { fetchFromServer } from "../server/proxy";
import type { ItemData } from "@contfu/contfu";
import * as v from "valibot";

const propFilterSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  op: v.picklist(["eq", "contains"]),
  value: v.union([v.string(), v.number(), v.boolean()]),
});

const queryItemsInputSchema = v.object({
  collection: v.optional(v.string()),
  changedAtFrom: v.optional(v.number()),
  changedAtTo: v.optional(v.number()),
  propFilters: v.optional(v.array(propFilterSchema)),
  sortField: v.optional(v.picklist(["changedAt", "collection"])),
  sortDirection: v.optional(v.picklist(["asc", "desc"])),
  page: v.optional(v.number()),
  pageSize: v.optional(v.number()),
});

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
  const params = new URLSearchParams();
  if (input.collection) params.set("collection", input.collection);
  if (input.changedAtFrom != null) params.set("changedAtFrom", String(input.changedAtFrom));
  if (input.changedAtTo != null) params.set("changedAtTo", String(input.changedAtTo));
  if (input.sortField) params.set("sortField", input.sortField);
  if (input.sortDirection) params.set("sortDirection", input.sortDirection);
  if (input.page != null) params.set("page", String(input.page));
  if (input.pageSize != null) params.set("pageSize", String(input.pageSize));
  if (input.propFilters?.length) params.set("propFilters", JSON.stringify(input.propFilters));

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
