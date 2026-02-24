import { and, eq, gt, gte, like, lt, lte, ne, not, or, sql, type SQL } from "drizzle-orm";
import { itemsTable } from "../db/schema";
import { basenameExpr, depthExpr, parentExpr } from "./path-helpers";
import type { FilterAST } from "./types";

const DIRECT_COLUMNS: Record<string, typeof itemsTable.collection> = {
  collection: itemsTable.collection,
  changedAt: itemsTable.changedAt,
  ref: itemsTable.ref,
  sourceType: itemsTable.sourceType,
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

function getColumn(field: string): SQL | typeof itemsTable.collection {
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
      const col = getColumn(ast.field);
      return compileComparison(col, ast.op, ast.value);
    }

    case "function": {
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

function compileComparison(
  col: SQL | typeof itemsTable.collection,
  op: string,
  value: string | number | boolean | null,
): SQL {
  const val = compileValue(value);

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
