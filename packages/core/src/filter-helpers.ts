const SYSTEM_FIELD_NAMES = ["$id", "$ref", "$collection", "$changedAt", "$connectionType"] as const;

type SystemFieldName = (typeof SYSTEM_FIELD_NAMES)[number];

const SYSTEM_FIELD_SET = new Set<string>(SYSTEM_FIELD_NAMES);

const FIELD_REF_TAG = Symbol("FieldRef");

export type FieldRef = {
  [FIELD_REF_TAG]: true;
  path: string;
};

type SystemFieldRefs = { [K in SystemFieldName]: FieldRef };

export type ItemRef<Props> = SystemFieldRefs & { [K in keyof Props & string]: FieldRef } & Record<
    string,
    FieldRef
  >;

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
