import { FileStatus, fileStatusFromName, fileStatusToName } from "../../domain/file-status";
import { deleteNulls } from "../../util/object-helpers";
import { decodeId, encodeId } from "../ids";
import type { FileData, ContentLinks, ItemData } from "../types/content-types";
import type { DbFile, DbItem, ItemUpdate, NewFile, NewItem } from "./schema";

export function fileToDb(file: FileData): NewFile {
  const { ext, size, attempts, error } = file;
  const width = "width" in file ? file.width : undefined;
  const height = "height" in file ? file.height : undefined;
  const duration = "duration" in file ? file.duration : undefined;
  return {
    id: decodeId(file.id),
    status: fileStatusFromName(file.status),
    mediaType: file.mediaType,
    meta: deleteNulls({ ext, size, width, height, duration, attempts, error }),
    ...(file.data != null && { data: file.data }),
    createdAt: file.createdAt,
  };
}

export function fileFromDb(dbo: DbFile, opts: { includeData?: boolean } = {}): FileData {
  const meta = dbo.meta ?? {};
  return deleteNulls({
    id: encodeId(dbo.id),
    status: fileStatusToName(dbo.status ?? FileStatus.Ready),
    mediaType: dbo.mediaType,
    ext: typeof meta.ext === "string" ? meta.ext : "bin",
    size: typeof meta.size === "number" ? meta.size : 0,
    ...(opts.includeData !== false && { data: dbo.data ?? undefined }),
    createdAt: dbo.createdAt,
    width: typeof meta.width === "number" ? meta.width : undefined,
    height: typeof meta.height === "number" ? meta.height : undefined,
    attempts: typeof meta.attempts === "number" ? meta.attempts : undefined,
    error: typeof meta.error === "string" ? meta.error : undefined,
    duration: typeof meta.duration === "number" ? meta.duration : undefined,
  });
}

export function fileMetadataFromDb(dbo: DbFile): FileData {
  return fileFromDb(dbo, { includeData: false });
}

function splitLocaleFromProps(props: Record<string, unknown> | null | undefined): {
  locale: string | null;
  props: Record<string, unknown>;
} {
  const { $locale, ...rest } = props ?? {};
  return {
    locale: typeof $locale === "string" ? $locale : null,
    props: rest,
  };
}

export function propsWithLocale(
  props: Record<string, unknown> | null | undefined,
  locale: string | null | undefined,
): Record<string, unknown> {
  const base = props && typeof props === "object" && !Array.isArray(props) ? props : {};
  if (locale == null) return base;
  return { ...base, $locale: locale };
}

export function itemToDb<T extends ItemData | Omit<ItemData, "links">>(
  item: T,
  _ctx: any,
): ItemUpdate | NewItem {
  const { locale, props } = splitLocaleFromProps(item.props);
  return {
    id: item.id,
    collection: item.collection,
    props,
    locale,
    content: item.content ? item.content : null,
    changedAt: item.changedAt,
  } satisfies ItemUpdate;
}

export function itemFromDb(dbo: DbItem, _ctx: any, links?: ContentLinks): ItemData {
  return deleteNulls({
    id: dbo.id,
    collection: dbo.collection,
    props: propsWithLocale(dbo.props, dbo.locale),
    content: dbo.content ? dbo.content : undefined,
    changedAt: dbo.changedAt,
    links: links ?? [],
  });
}
