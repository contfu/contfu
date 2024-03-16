import { getDb } from "../../core/db/db";
import type { DbConnection } from "../../core/db/schema";

export function getConnections(): Promise<DbConnection[]> {
  return getDb().selectFrom("connection").selectAll().execute();
}
