const SYSTEM_FIELD_NAMES = ["$id", "$ref", "$collection", "$changedAt", "$connectionType"] as const;

const SYSTEM_FIELD_SET = new Set<string>(SYSTEM_FIELD_NAMES);

const FIELD_REF_TAG = Symbol("FieldRef");
declare const FIELD_TYPE_TAG: unique symbol;

export type FieldRef<T = unknown> = {
  [FIELD_REF_TAG]: true;
  path: string;
  readonly [FIELD_TYPE_TAG]?: T;
};

type SystemFieldRefs = {
  $id: FieldRef<string>;
  $ref: FieldRef<string>;
  $collection: FieldRef<string>;
  $changedAt: FieldRef<number>;
  $connectionType: FieldRef<string | null>;
};

export type ItemRef<Props> = SystemFieldRefs & {
  [K in keyof Props & string]: FieldRef<Props[K]>;
} & Record<string, FieldRef<unknown>>;

export function isFieldRef(value: unknown): value is FieldRef {
  return typeof value === "object" && value !== null && FIELD_REF_TAG in value;
}

export function createItemRef<Props>(level: number): ItemRef<Props> {
  const prefix = level === 0 ? "" : `$${level}.`;

  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (typeof prop !== "string") return undefined;
        const path =
          SYSTEM_FIELD_SET.has(prop) || prop.startsWith("$")
            ? `${prefix}${prop}`
            : `${prefix}${prop}`;
        return { [FIELD_REF_TAG]: true, path } as FieldRef;
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
type Comparable = string | number;

function binOp(op: string) {
  return (a: FilterOperand, b: FilterOperand): string =>
    `${formatValue(a)} ${op} ${formatValue(b)}`;
}

const _eq = binOp("=");
const _ne = binOp("!=");
const _gt = binOp(">");
const _gte = binOp(">=");
const _lt = binOp("<");
const _lte = binOp("<=");
const _like = binOp("~");
const _notLike = binOp("!~");
const _contains = binOp("?=");

export function eq<T>(a: FieldRef<T>, b: T | FieldRef<T> | null): string;
export function eq(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function eq(a: FilterOperand, b: FilterOperand): string {
  return _eq(a, b);
}

export function ne<T>(a: FieldRef<T>, b: T | FieldRef<T> | null): string;
export function ne(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function ne(a: FilterOperand, b: FilterOperand): string {
  return _ne(a, b);
}

export function gt<T extends Comparable>(a: FieldRef<T>, b: T): string;
export function gt(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function gt(a: FilterOperand, b: FilterOperand): string {
  return _gt(a, b);
}

export function gte<T extends Comparable>(a: FieldRef<T>, b: T): string;
export function gte(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function gte(a: FilterOperand, b: FilterOperand): string {
  return _gte(a, b);
}

export function lt<T extends Comparable>(a: FieldRef<T>, b: T): string;
export function lt(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function lt(a: FilterOperand, b: FilterOperand): string {
  return _lt(a, b);
}

export function lte<T extends Comparable>(a: FieldRef<T>, b: T): string;
export function lte(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function lte(a: FilterOperand, b: FilterOperand): string {
  return _lte(a, b);
}

export function like<T extends string>(a: FieldRef<T>, b: string): string;
export function like(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function like(a: FilterOperand, b: FilterOperand): string {
  return _like(a, b);
}

export function notLike<T extends string>(a: FieldRef<T>, b: string): string;
export function notLike(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function notLike(a: FilterOperand, b: FilterOperand): string {
  return _notLike(a, b);
}

export function contains<T>(a: FieldRef<T[]>, b: T): string;
export function contains(a: Exclude<FilterOperand, FieldRef>, b: FilterOperand): string;
export function contains(a: FilterOperand, b: FilterOperand): string {
  return _contains(a, b);
}

export function linksTo(prop: string | null, target: FilterOperand): string {
  const propArg = prop !== null ? `"${prop}"` : "";
  return `linksTo(${propArg}) = ${formatValue(target)}`;
}

export function linkedFrom(prop: string | null, source: FilterOperand): string {
  const propArg = prop !== null ? `"${prop}"` : "";
  return `linkedFrom(${propArg}) = ${formatValue(source)}`;
}

export function and(...exprs: string[]): string {
  return exprs.map((e) => `(${e})`).join(" && ");
}

export function or(...exprs: string[]): string {
  return exprs.map((e) => `(${e})`).join(" || ");
}

export function all<C extends string>(collection: C): { collection: C };
export function all<C extends string>(
  collection: C,
  filter: string,
): { collection: C; filter: string };
export function all<C extends string>(
  collection: C,
  filter: (self: any) => string,
): { collection: C; filter: (self: any) => string };
export function all(
  collection: string,
  filterOrOpts?: string | ((self: any) => string) | Record<string, unknown>,
) {
  if (filterOrOpts == null) return { collection };
  if (typeof filterOrOpts === "string" || typeof filterOrOpts === "function") {
    return { collection, filter: filterOrOpts };
  }
  return { collection, ...filterOrOpts };
}

export function oneOf<C extends string>(collection: C): { collection: C; single: true };
export function oneOf<C extends string>(
  collection: C,
  filter: string,
): { collection: C; single: true; filter: string };
export function oneOf<C extends string>(
  collection: C,
  filter: (self: any) => string,
): { collection: C; single: true; filter: (self: any) => string };
export function oneOf(
  collection: string,
  filterOrOpts?: string | ((self: any) => string) | Record<string, unknown>,
) {
  if (filterOrOpts == null) return { collection, single: true as const };
  if (typeof filterOrOpts === "string" || typeof filterOrOpts === "function") {
    return { collection, single: true as const, filter: filterOrOpts };
  }
  return { collection, single: true as const, ...filterOrOpts };
}
