import type { AssetData } from "../../infra/types/content-types";
import { eq } from "drizzle-orm";
import { assetFromDb } from "../../infra/db/mappers";
import { db } from "../../infra/db/db";
import { decodeId } from "../../infra/ids";
import { assetTable } from "../../infra/db/schema";

export function getAsset(id: string, ctx = db): AssetData | null {
  const dbos = ctx
    .select()
    .from(assetTable)
    .where(eq(assetTable.id, decodeId(id)))
    .all();

  return dbos.length > 0 ? assetFromDb(dbos[0]) : null;
}
