import { db } from "../../db/db";
import { assetTable } from "../../db/schema";

export async function countAssets() {
  return db.$count(assetTable);
}
