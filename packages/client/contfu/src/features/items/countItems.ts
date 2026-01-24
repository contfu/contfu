import { db } from "../../db/db";
import { itemsTable } from "../../db/schema";

export async function countItems() {
  return db.$count(itemsTable);
}
