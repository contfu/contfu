import { and, eq, inArray, isNull } from "drizzle-orm";
import { db as defaultDb } from "./db";
import {
  collectionsTable,
  externalLinkTable,
  fileTable,
  internalLinkTable,
  itemFileTable,
  itemsTable,
} from "./schema";
import { fileMetadataFromDb, propsWithLocale } from "./mappers";
import type { ResolvedLink } from "../types/content-types";
import {
  normalizeFileMetadata,
  PropertyType,
  schemaType,
  type CollectionSchema,
  type FileMetadata,
  type FileMetadataOptions,
  type IncludeOption,
} from "@contfu/core";
import type { ItemWithRelations } from "../../domain/query-types";

type ResolveIncludesOptions = FileMetadataOptions;

function isFileType(type: number): boolean {
  return (type & PropertyType.FILE) !== 0;
}

function isFilesType(type: number): boolean {
  return (type & PropertyType.FILES) !== 0;
}

function hydrateFileRefs(
  item: ItemWithRelations,
  files: FileMetadata[],
  schema: CollectionSchema | undefined,
  options: ResolveIncludesOptions,
): void {
  const byRef = new Map(files.map((file) => [`${file.id}.${file.ext}`, file]));
  for (const [key, value] of Object.entries(item)) {
    const type = schema?.[key] == null ? undefined : schemaType(schema[key]);
    if (typeof value === "string") {
      const file =
        byRef.get(value) ??
        (type != null && isFileType(type) ? normalizeFileMetadata(value, options) : undefined);
      if (file) item[key] = file;
    } else if (Array.isArray(value) && type != null && isFilesType(type)) {
      const hydrated = value.map((entry) =>
        typeof entry === "string"
          ? (byRef.get(entry) ?? normalizeFileMetadata(entry, options) ?? entry)
          : entry,
      );
      if (hydrated.some((entry, index) => entry !== value[index])) item[key] = hydrated;
    } else if (Array.isArray(value)) {
      const hydrated = value.map((entry) =>
        typeof entry === "string" ? (byRef.get(entry) ?? entry) : entry,
      );
      if (hydrated.some((entry, index) => entry !== value[index])) item[key] = hydrated;
    }
  }
}

export function resolveIncludes(
  items: ItemWithRelations[],
  include: IncludeOption[],
  ctx = defaultDb,
  options: ResolveIncludesOptions = {},
): void {
  if (items.length === 0 || include.length === 0) return;

  const ids = items.map((i) => i.$id);

  if (include.includes("files")) {
    const rows = ctx
      .select({
        itemId: itemFileTable.itemId,
        file: {
          id: fileTable.id,
          status: fileTable.status,
          mediaType: fileTable.mediaType,
          meta: fileTable.meta,
          createdAt: fileTable.createdAt,
        },
      })
      .from(itemFileTable)
      .innerJoin(fileTable, eq(itemFileTable.fileId, fileTable.id))
      .where(inArray(itemFileTable.itemId, ids))
      .all();

    const filesByItem = new Map<number, FileMetadata[]>();
    for (const row of rows) {
      const itemId = row.itemId;
      if (!filesByItem.has(itemId)) filesByItem.set(itemId, []);
      const file = normalizeFileMetadata(fileMetadataFromDb({ ...row.file, data: null }), options);
      if (file) filesByItem.get(itemId)!.push(file);
    }

    const collectionSchemas = new Map<string, CollectionSchema>();
    const collectionNames = [...new Set(items.map((item) => item.$collection))];
    if (collectionNames.length > 0) {
      const schemaRows = ctx
        .select({ name: collectionsTable.name, schema: collectionsTable.schema })
        .from(collectionsTable)
        .where(inArray(collectionsTable.name, collectionNames))
        .all();
      for (const row of schemaRows) {
        if (row.schema && typeof row.schema === "object" && !Array.isArray(row.schema)) {
          collectionSchemas.set(row.name, row.schema);
        }
      }
    }

    for (const item of items) {
      const files = filesByItem.get(item.$id) ?? [];
      item.files = files;
      hydrateFileRefs(item, files, collectionSchemas.get(item.$collection), options);
    }
  }

  if (include.includes("links")) {
    const internalRows = ctx
      .select()
      .from(internalLinkTable)
      .where(and(inArray(internalLinkTable.from, ids), isNull(internalLinkTable.prop)))
      .all();
    const externalRows = ctx
      .select()
      .from(externalLinkTable)
      .where(inArray(externalLinkTable.from, ids))
      .all();

    const internalTargetIds = new Set<number>();
    for (const row of internalRows) internalTargetIds.add(row.to);

    const targetItemMap = new Map<number, Record<string, unknown>>();
    if (internalTargetIds.size > 0) {
      const targetRows = ctx
        .select()
        .from(itemsTable)
        .where(inArray(itemsTable.id, [...internalTargetIds]))
        .all();
      for (const row of targetRows) {
        const id = row.id;
        targetItemMap.set(id, {
          $id: id,
          $collection: row.collection,
          $changedAt: row.changedAt,
          ...propsWithLocale(
            row.props && typeof row.props === "object" && !Array.isArray(row.props)
              ? row.props
              : {},
            row.locale,
          ),
        });
      }
    }

    const linksByItem = new Map<number, ResolvedLink[]>();
    for (const row of internalRows) {
      const fromId = row.from;
      if (!linksByItem.has(fromId)) linksByItem.set(fromId, []);
      linksByItem.get(fromId)!.push((targetItemMap.get(row.to) as ResolvedLink) ?? null);
    }
    for (const row of externalRows) {
      const fromId = row.from;
      if (!linksByItem.has(fromId)) linksByItem.set(fromId, []);
      linksByItem.get(fromId)!.push(row.url);
    }

    for (const item of items) {
      item.links = linksByItem.get(item.$id) ?? [];
    }
  }
}
