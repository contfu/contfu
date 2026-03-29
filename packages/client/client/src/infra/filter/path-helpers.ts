import { sql, type SQL } from "drizzle-orm";
import { itemsTable } from "../db/schema";

/**
 * SQL expression for parent(ref) — the path up to the last '/'.
 * e.g. "a/b/c" → "a/b"
 */
export function parentExpr(column: SQL | typeof itemsTable.ref = itemsTable.ref): SQL {
  return sql`CASE WHEN INSTR(${column}, '/') > 0 THEN SUBSTR(${column}, 1, LENGTH(${column}) - LENGTH(SUBSTR(${column}, LENGTH(RTRIM(${column}, REPLACE(${column}, '/', ''))) + 1))) ELSE '' END`;
}

/**
 * SQL expression for depth(ref) — number of '/' separators + 1.
 * e.g. "a/b/c" → 3
 */
export function depthExpr(column: SQL | typeof itemsTable.ref = itemsTable.ref): SQL {
  return sql`(LENGTH(${column}) - LENGTH(REPLACE(${column}, '/', '')) + 1)`;
}

/**
 * SQL expression for basename(ref) — text after the last '/'.
 * e.g. "a/b/c" → "c"
 */
export function basenameExpr(column: SQL | typeof itemsTable.ref = itemsTable.ref): SQL {
  return sql`CASE WHEN INSTR(${column}, '/') > 0 THEN SUBSTR(${column}, LENGTH(RTRIM(${column}, REPLACE(${column}, '/', ''))) + 1) ELSE ${column} END`;
}
