import type { ItemIdentity } from "@contfu/core";
import type { ItemData } from "../../infra/types/content-types";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemFromDb } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";

export function getItem({ id }: { id: ItemIdentity }, ctx = db): Omit<ItemData, "links"> | null {
  const dbos = ctx
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.identity, id), isNull(itemsTable.deletedAt)))
    .all();

  return dbos.length > 0 ? itemFromDb(dbos[0], ctx) : null;
}
