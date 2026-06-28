import type { FileData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { fileFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { fileTable } from "../../infra/db/schema";

export function getFile(
  id: string,
  ctx = db,
  opts: { includeData?: boolean } = {},
): FileData | null {
  if (opts.includeData === false) {
    const dbos = ctx
      .select({
        id: fileTable.id,
        status: fileTable.status,
        mediaType: fileTable.mediaType,
        meta: fileTable.meta,
        createdAt: fileTable.createdAt,
      })
      .from(fileTable)
      .where(eq(fileTable.id, decodeId(id)))
      .all();

    return dbos.length > 0 ? fileFromDb({ ...dbos[0], data: null }, opts) : null;
  }

  const dbos = ctx
    .select()
    .from(fileTable)
    .where(eq(fileTable.id, decodeId(id)))
    .all();

  return dbos.length > 0 ? fileFromDb(dbos[0], opts) : null;
}
