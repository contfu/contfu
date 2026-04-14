import { inArray } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { fileTable } from "../../infra/db/schema";

export function deleteFiles(ids: string[], ctx = db): void {
  if (ids.length === 0) return;

  ctx
    .delete(fileTable)
    .where(
      inArray(
        fileTable.id,
        ids.map((id) => decodeId(id)),
      ),
    )
    .run();
}
