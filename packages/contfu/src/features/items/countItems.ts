import { db } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";

export function countItems() {
  return db.$count(itemsTable);
}
