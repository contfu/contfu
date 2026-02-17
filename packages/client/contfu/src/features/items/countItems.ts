import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";

export async function countItems() {
  return db.$count(itemsTable);
}
