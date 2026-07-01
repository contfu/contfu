import type { Block } from "./blocks";
import { createItemRef } from "./filter-helpers";
import type { MarkdownOptions } from "./markdown";
import type { RenderOptions } from "./render";

export type ContentFormat = "object" | "markdown" | "html";

export type ResolvedContent<F extends ContentFormat | undefined> = F extends "markdown" | "html"
  ? string
  : Block[];

export type WithClause = {
  [relation: string]: {
    collection?: string;
    filter?: string;
    limit?: number;
    include?: IncludeOption[];
    single?: boolean;
    with?: WithClause;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
  };
};

export type IncludeOption = "files" | "links" | "content";

export type FileStatusData = "pending" | "ready" | "failed";

export type FileMetadata = {
  url: string;
  id?: string;
  ext?: string;
  status?: FileStatusData;
  mediaType?: string;
  size?: number;
  createdAt?: number;
  width?: number;
  height?: number;
  duration?: number;
  attempts?: number;
  error?: string;
};

export type FileMetadataOptions = {
  filesBasePath?: string;
};

export type SortOption = string | { field: string; direction: "asc" | "desc" };

export type QueryOptions = {
  filter?: string;
  sort?: SortOption | SortOption[];
  limit?: number;
  offset?: number;
  include?: IncludeOption[];
  fileMode?: "local" | "remote";
  with?: WithClause;
  fields?: string[];
  search?: string;
  /** Flatten nested object props into dot-separated result keys. */
  flat?: boolean;
  contentAs?: ContentFormat;
  htmlOptions?: RenderOptions;
  markdownOptions?: MarkdownOptions;
  /** Base path used when resolving internal file metadata URLs. */
  filesBasePath?: string;
  /** Requested locale. `false` explicitly requests all locales and suppresses defaults. */
  locale?: string | false;
  /** Fallback locale override. `true` resolves to the configured default locale; `false` disables fallback. */
  fallback?: string | true | false;
  /** Include soft-deleted items in addition to active items. */
  includeDeleted?: boolean;
  /** Return only soft-deleted items. */
  onlyDeleted?: boolean;
};

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith("//");
}

function isRelativeUrl(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function normalizeFilesBasePath(filesBasePath: string | undefined): string {
  const base = filesBasePath ?? "/files";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function buildFileMetadataUrl(
  file: Pick<FileMetadata, "id" | "ext"> & Partial<Pick<FileMetadata, "url">>,
  options: FileMetadataOptions = {},
): string {
  if (file.url && isAbsoluteUrl(file.url)) return file.url;
  if (!file.id || !file.ext) return file.url ?? "";
  return `${normalizeFilesBasePath(options.filesBasePath)}/${file.id}.${file.ext}`;
}

export function normalizeFileMetadata(
  value: unknown,
  options: FileMetadataOptions = {},
): FileMetadata | undefined {
  if (typeof value === "string") {
    if (isAbsoluteUrl(value) || isRelativeUrl(value)) return { url: value };
    const match = value.match(/^(.+)\.([^.]+)$/);
    if (!match) return undefined;
    return {
      id: match[1],
      ext: match[2],
      url: buildFileMetadataUrl({ id: match[1], ext: match[2] }, options),
    };
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const file = value as FileMetadata;
  if (typeof file.url === "string") return { ...file, url: buildFileMetadataUrl(file, options) };
  if (typeof file.id === "string" && typeof file.ext === "string") {
    return { ...file, url: buildFileMetadataUrl(file, options) };
  }
  return undefined;
}

export function normalizeIncludedFileMetadata<T extends Record<string, unknown>>(
  items: T[],
  options: FileMetadataOptions = {},
): T[] {
  for (const item of items) {
    const rawFiles = item["files"];
    const files = Array.isArray(rawFiles)
      ? rawFiles
          .map((file) => normalizeFileMetadata(file, options))
          .filter((file) => file !== undefined)
      : [];
    const byRef = new Map(files.map((file) => [`${file.id}.${file.ext}`, file]));
    if (Array.isArray(rawFiles)) (item as Record<string, unknown>)["files"] = files;

    for (const [key, value] of Object.entries(item)) {
      if (key === "files") continue;
      if (typeof value === "string") {
        const file = byRef.get(value) ?? normalizeFileMetadata(value, options);
        if (file) item[key as keyof T] = file as T[keyof T];
      } else if (Array.isArray(value)) {
        const hydrated = value.map((entry) => {
          if (typeof entry === "string") {
            return byRef.get(entry) ?? normalizeFileMetadata(entry, options) ?? entry;
          }
          return normalizeFileMetadata(entry, options) ?? entry;
        });
        if (hydrated.some((entry, index) => entry !== value[index])) {
          item[key as keyof T] = hydrated as T[keyof T];
        }
      } else {
        const file = normalizeFileMetadata(value, options);
        if (file) item[key as keyof T] = file as T[keyof T];
      }
    }
  }
  return items;
}

export type QueryFilterFunction = (self: any) => string;

export type QueryWithEntry = Omit<WithClause[string], "filter" | "with"> & {
  filter?: string | QueryFilterFunction;
  with?: QueryWithInput;
};

export type QueryWithEntries = Record<string, QueryWithEntry>;

export type QueryWithInput = QueryWithEntries | ((parent: any) => QueryWithEntries);

export function resolveQueryFilter(filter: unknown, level = 0): string | undefined {
  if (typeof filter === "function") return (filter as QueryFilterFunction)(createItemRef(level));
  return filter as string | undefined;
}

export function resolveQueryWithFunctions(
  withVal: QueryWithInput | undefined,
  parentLevel = 1,
): WithClause | undefined {
  if (!withVal) return undefined;

  const entries = typeof withVal === "function" ? withVal(createItemRef(parentLevel)) : withVal;
  const result: WithClause = {};

  for (const [name, entry] of Object.entries(entries)) {
    result[name] = {
      collection: entry.collection,
      filter: resolveQueryFilter(entry.filter),
      limit: entry.limit,
      include: entry.include,
      single: entry.single,
      with: resolveQueryWithFunctions(entry.with, parentLevel + 1),
      includeDeleted: entry.includeDeleted,
      onlyDeleted: entry.onlyDeleted,
    };
  }

  return result;
}

export type QueryCallOptions = Omit<QueryOptions, "filter" | "with"> & {
  collection?: string;
  filter?: string | QueryFilterFunction;
  with?: QueryWithInput;
  [key: string]: unknown;
};

export function normalizeQueryArgs(
  first?: string | QueryCallOptions,
  second?: unknown,
): { options: QueryCallOptions } {
  if (typeof first === "string") {
    if (second == null) return { options: { collection: first } };
    if (typeof second === "string" || typeof second === "function") {
      return { options: { collection: first, filter: second as string | QueryFilterFunction } };
    }
    return { options: { collection: first, ...(second as QueryCallOptions) } };
  }
  return { options: first ?? {} };
}

export type QueryMeta = {
  total: number;
  limit: number;
  offset: number;
};

export class QueryResultArray<T> extends Array<T> {
  total: number;
  limit: number;
  offset: number;
  static get [Symbol.species]() {
    return Array;
  }
  constructor(items: T[], meta: QueryMeta) {
    super(...items);
    this.total = meta.total;
    this.limit = meta.limit;
    this.offset = meta.offset;
  }
  get meta(): QueryMeta {
    return { total: this.total, limit: this.limit, offset: this.offset };
  }
  toJSON() {
    return {
      data: Array.from(this),
      meta: this.meta,
    };
  }
}
