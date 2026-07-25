import { eq } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { mediaMasterTable } from "../../infra/db/schema";
import { decodeId } from "../../infra/ids";

export function getMediaMaster(fileId: string) {
  return db
    .select()
    .from(mediaMasterTable)
    .where(eq(mediaMasterTable.fileId, decodeId(fileId)))
    .get();
}
