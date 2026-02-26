const FIELD_REF_TAG = Symbol("FieldRef");

export type FieldRef = {
  [FIELD_REF_TAG]: true;
  path: string;
};

export function isFieldRef(value: unknown): value is FieldRef {
  return typeof value === "object" && value !== null && FIELD_REF_TAG in value;
}

/** Proxy shape for typed property access on an item */
export type ItemRef<Props> = {
  id: FieldRef;
  ref: FieldRef;
  collection: FieldRef;
  props: { [K in keyof Props]: FieldRef };
};

export function createItemRef<Props>(level: number): ItemRef<Props> {
  const prefix = level === 0 ? "" : `$${level}.`;

  const propsProxy = new Proxy(
    {},
    {
      get(_target, prop: string): FieldRef {
        return { [FIELD_REF_TAG]: true, path: `${prefix}props.${prop}` } as FieldRef;
      },
    },
  );

  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "props") return propsProxy;
        return { [FIELD_REF_TAG]: true, path: `${prefix}${prop}` } as FieldRef;
      },
    },
  ) as ItemRef<Props>;
}

function formatValue(v: FieldRef | string | number | boolean | null): string {
  if (isFieldRef(v)) return v.path;
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

type FilterOperand = FieldRef | string | number | boolean | null;

function binOp(op: string) {
  return (a: FilterOperand, b: FilterOperand): string =>
    `${formatValue(a)} ${op} ${formatValue(b)}`;
}

export const eq = binOp("=");
export const ne = binOp("!=");
export const gt = binOp(">");
export const gte = binOp(">=");
export const lt = binOp("<");
export const lte = binOp("<=");
export const like = binOp("~");
export const notLike = binOp("!~");
export const contains = binOp("?=");

export function and(...exprs: string[]): string {
  return exprs.map((e) => `(${e})`).join(" && ");
}

export function or(...exprs: string[]): string {
  return exprs.map((e) => `(${e})`).join(" || ");
}

// --- With-clause function resolution ---

import type { TypedWithEntry, TypedWithInput, WithClause } from "./query-types";

export function resolveWithFunctions(
  withVal: TypedWithInput<any, any>,
  parentLevel: number,
): WithClause {
  let entries: { [rel: string]: TypedWithEntry<any, any> };

  if (typeof withVal === "function") {
    const parentRef = createItemRef<any>(parentLevel);
    entries = withVal(parentRef);
  } else {
    entries = withVal;
  }

  const result: WithClause = {};
  for (const [name, entry] of Object.entries(entries)) {
    let filter: string | undefined;
    if (typeof entry.filter === "function") {
      const selfRef = createItemRef<any>(0);
      filter = entry.filter(selfRef);
    } else {
      filter = entry.filter;
    }

    result[name] = {
      collection: entry.collection,
      filter,
      limit: entry.limit,
      include: entry.include,
      single: entry.single,
      with: entry.with ? resolveWithFunctions(entry.with, parentLevel + 1) : undefined,
    };
  }
  return result;
}
