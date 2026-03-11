import { and, eq, gt, gte, like, lt, lte, ne, not, or, sql, type SQL } from "drizzle-orm";
import { itemsTable } from "../db/schema";
import { decodeId } from "../ids";
import { basenameExpr, depthExpr, parentExpr } from "./path-helpers";
import type { FilterAST } from "./types";

const DIRECT_COLUMNS: Record<string, SQL> = {
  collection: sql`${itemsTable.collection}`,
  changedAt: sql`${itemsTable.changedAt}`,
  ref: sql`${itemsTable.ref}`,
  connectionType: sql`${itemsTable.connectionType}`,
};

const FUNCTION_MAP: Record<string, (args: string[]) => SQL> = {
  parent: (args) =>
    parentExpr(args[0] ? (DIRECT_COLUMNS[args[0]] ?? itemsTable.ref) : itemsTable.ref),
  depth: (args) =>
    depthExpr(args[0] ? (DIRECT_COLUMNS[args[0]] ?? itemsTable.ref) : itemsTable.ref),
  basename: (args) =>
    basenameExpr(args[0] ? (DIRECT_COLUMNS[args[0]] ?? itemsTable.ref) : itemsTable.ref),
};

function jsonExtract(field: string): SQL {
  // props.X → json_extract(props, '$.X')
  const path = field.startsWith("props.") ? field.slice(6) : field;
  return sql`json_extract(${itemsTable.props}, ${"$." + path})`;
}

function getColumn(field: string): SQL {
  if (field in DIRECT_COLUMNS) return DIRECT_COLUMNS[field];
  return jsonExtract(field);
}

function compileValue(value: string | number | boolean | null): SQL {
  if (value === null) return sql`NULL`;
  if (typeof value === "boolean") return value ? sql`1` : sql`0`;
  return sql`${value}`;
}

export function compileFilter(ast: FilterAST): SQL {
  switch (ast.kind) {
    case "comparison": {
      if (ast.field === "id" && typeof ast.value === "string") {
        const col = sql`${itemsTable.id}`;
        const buf = decodeId(ast.value);
        return compileComparison(col, ast.op, sql`${buf}`);
      }
      const col = getColumn(ast.field);
      return compileComparison(col, ast.op, ast.value);
    }

    case "function": {
      if (ast.name === "linksTo") {
        if (typeof ast.value !== "string") throw new Error("linksTo requires a string target ID");
        const prop = ast.args[0];
        const buf = decodeId(ast.value);
        const propCondition = prop ? sql`links.prop = ${prop}` : sql`links.prop IS NULL`;
        return sql`EXISTS (SELECT 1 FROM links WHERE links."from" = ${itemsTable.id} AND ${propCondition} AND links."to" = ${buf})`;
      }
      if (ast.name === "linkedFrom") {
        if (typeof ast.value !== "string")
          throw new Error("linkedFrom requires a string source ID");
        const prop = ast.args[0];
        const buf = decodeId(ast.value);
        const propCondition = prop ? sql`links.prop = ${prop}` : sql`links.prop IS NULL`;
        return sql`EXISTS (SELECT 1 FROM links WHERE links."to" = ${itemsTable.id} AND ${propCondition} AND links."from" = ${buf})`;
      }
      const fn = FUNCTION_MAP[ast.name];
      if (!fn) throw new Error(`Unknown function: ${ast.name}`);
      const expr = fn(ast.args);
      return compileComparison(expr, ast.op, ast.value);
    }

    case "and":
      return and(compileFilter(ast.left), compileFilter(ast.right))!;

    case "or":
      return or(compileFilter(ast.left), compileFilter(ast.right))!;

    case "group":
      return compileFilter(ast.expr);
  }
}

function isSql(v: unknown): v is SQL {
  return typeof v === "object" && v !== null && "queryChunks" in v;
}

function compileComparison(
  col: SQL,
  op: string,
  value: string | number | boolean | null | SQL,
): SQL {
  const val = isSql(value) ? value : compileValue(value);

  switch (op) {
    case "=":
      if (value === null) return sql`${col} IS NULL`;
      return eq(col, val);
    case "!=":
      if (value === null) return sql`${col} IS NOT NULL`;
      return ne(col, val);
    case ">":
      return gt(col, val);
    case ">=":
      return gte(col, val);
    case "<":
      return lt(col, val);
    case "<=":
      return lte(col, val);
    case "~":
      return like(col, sql`${"%" + value + "%"}`);
    case "!~":
      return not(like(col, sql`${"%" + value + "%"}`));
    case "?=":
      return sql`EXISTS (SELECT 1 FROM json_each(${col}) WHERE value = ${val})`;
    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}
