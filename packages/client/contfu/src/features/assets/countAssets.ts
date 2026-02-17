import { db } from "../../infra/db/db";
import { assetTable } from "../../infra/db/schema";

export async function countAssets() {
  return db.$count(assetTable);
}
