import type { FileData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { fileFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { fileTable } from "../../infra/db/schema";

export function getFile(id: string, ctx = db): FileData | null {
  const dbos = ctx
    .select()
    .from(fileTable)
    .where(eq(fileTable.id, decodeId(id)))
    .all();

  return dbos.length > 0 ? fileFromDb(dbos[0]) : null;
}
