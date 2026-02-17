import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";

export async function countCollections() {
  return db.$count(collectionTable);
}
