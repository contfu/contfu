import { sql, type SQL } from "drizzle-orm";

export function parentExpr(column: SQL): SQL {
  return sql`CASE WHEN INSTR(${column}, '/') > 0 THEN SUBSTR(${column}, 1, LENGTH(${column}) - LENGTH(SUBSTR(${column}, LENGTH(RTRIM(${column}, REPLACE(${column}, '/', ''))) + 1))) ELSE '' END`;
}

export function depthExpr(column: SQL): SQL {
  return sql`(LENGTH(${column}) - LENGTH(REPLACE(${column}, '/', '')) + 1)`;
}

export function basenameExpr(column: SQL): SQL {
  return sql`CASE WHEN INSTR(${column}, '/') > 0 THEN SUBSTR(${column}, LENGTH(RTRIM(${column}, REPLACE(${column}, '/', ''))) + 1) ELSE ${column} END`;
}
