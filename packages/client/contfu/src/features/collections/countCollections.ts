import { db } from "../../db/db";
import { collectionTable } from "../../db/schema";

export async function countCollections() {
  return db.$count(collectionTable);
}
