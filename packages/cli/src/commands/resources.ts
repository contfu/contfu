import { ConnectionType, PropertyType, schemaType } from "@contfu/core";
import { apiFetch } from "../http";

const RESOURCES = ["connections", "collections", "flows"] as const;
type Resource = (typeof RESOURCES)[number];

export function isResource(name: string): name is Resource {
  return RESOURCES.includes(name as Resource);
}

export interface CliValues {
  name?: string;
  type?: string;
  url?: string;
  "display-name"?: string;
  "source-id"?: string;
  "target-id"?: string;
  "collection-id"?: string;
  "include-ref"?: boolean;
  "no-include-ref"?: boolean;
  token?: string;
}

const REQUIRED_CREATE: Record<Resource, (keyof CliValues)[]> = {
  connections: ["name"],
  collections: ["display-name"],
  flows: ["source-id", "target-id"],
};

function buildBody(
  resource: Resource,
  action: "create" | "update",
  values: CliValues,
): Record<string, unknown> {
  if (action === "create") {
    const missing = REQUIRED_CREATE[resource].filter((k) => values[k] === undefined);
    if (missing.length > 0) {
      console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(", ")}`);
      process.exit(1);
    }
  }

  // Connections use different field names
  if (resource === "connections") {
    const result: Record<string, unknown> = {};
    if (values.name !== undefined) result.label = values.name;
    if (values.type !== undefined) result.providerId = values.type;
    else if (action === "create") result.providerId = "notion";
    if (values.token !== undefined) result.token = values.token;
    return result;
  }

  // Flows
  if (resource === "flows") {
    const body: Record<string, unknown> = {};
    if (values["source-id"] !== undefined) body.sourceId = Number(values["source-id"]);
    if (values["target-id"] !== undefined) body.targetId = Number(values["target-id"]);
    if (values["include-ref"] === true) body.includeRef = true;
    if (values["no-include-ref"] === true) body.includeRef = false;
    return body;
  }

  // Collections
  const body: Record<string, unknown> = {};
  if (values.name !== undefined) body.name = values.name;
  if (values["display-name"] !== undefined) body.displayName = values["display-name"];
  if (values["include-ref"] === true) body.includeRef = true;
  if (values["no-include-ref"] === true) body.includeRef = false;

  return body;
}

type Column = { key: string; header: string; format?: (v: unknown) => string };

const PROPERTY_TYPE_LABEL: Record<number, string> = Object.fromEntries(
  (Object.entries(PropertyType) as [string, number][]).map(([k, v]) => [v, k.toLowerCase()]),
);

const PROPERTY_TYPE_VALUE: Record<string, number> = Object.fromEntries(
  (Object.entries(PropertyType) as [string, number][]).map(([k, v]) => [k.toLowerCase(), v]),
);

function untransformSchema(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(untransformSchema);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "schema" && v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([prop, type]) => [
          prop,
          typeof type === "string" ? (PROPERTY_TYPE_VALUE[type] ?? type) : type,
        ]),
      );
    } else {
      result[k] = untransformSchema(v);
    }
  }
  return result;
}

function transformSchema(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(transformSchema);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "schema" && v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = Object.fromEntries(
        Object.entries(v as Record<string, number | [number, string[]]>).map(([prop, value]) => {
          const type = schemaType(value);
          const label = PROPERTY_TYPE_LABEL[type] ?? type;
          const enumVals = Array.isArray(value) ? value[1] : undefined;
          return [
            prop,
            enumVals && enumVals.length > 0 ? `${label}(${enumVals.join("|")})` : label,
          ];
        }),
      );
    } else {
      result[k] = transformSchema(v);
    }
  }
  return result;
}

function printJson(data: unknown) {
  console.log(JSON.stringify(transformSchema(data), null, 2));
}

const TABLE_COLUMNS: Record<Resource, Column[]> = {
  connections: [
    { key: "id", header: "ID" },
    { key: "label", header: "Label" },
    { key: "providerId", header: "Provider" },
    { key: "accountId", header: "Account" },
    { key: "hasCredentials", header: "Credentials", format: (v) => (v ? "yes" : "no") },
  ],
  collections: [
    { key: "id", header: "ID" },
    { key: "name", header: "Name" },
    { key: "displayName", header: "Display Name" },
    {
      key: "connectionId",
      header: "Connection",
    },
  ],
  flows: [
    { key: "id", header: "ID" },
    { key: "sourceId", header: "Source" },
    { key: "targetId", header: "Target" },
    { key: "includeRef", header: "Ref", format: (v) => (v ? "yes" : "no") },
  ],
};

function printTable(rows: Record<string, unknown>[], columns: Column[]) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  const cell = (col: Column, row: Record<string, unknown>) =>
    col.format ? col.format(row[col.key]) : String(row[col.key] ?? "");
  const widths = columns.map((col) =>
    Math.max(col.header.length, ...rows.map((r) => cell(col, r).length)),
  );
  console.log(columns.map((col, i) => col.header.padEnd(widths[i])).join("  "));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(columns.map((col, i) => cell(col, row).padEnd(widths[i])).join("  "));
  }
}

export async function list(resource: Resource, format: string) {
  const res = await apiFetch(`/api/v1/${resource}`);
  const data = (await res.json()) as Record<string, unknown>[];
  if (format === "json") {
    printJson(data);
  } else {
    printTable(data, TABLE_COLUMNS[resource]);
  }
}

export async function get(resource: Resource, id: string) {
  const res = await apiFetch(`/api/v1/${resource}/${id}`);
  const data = await res.json();
  printJson(data);
}

export async function create(resource: Resource, jsonData: string | undefined, values: CliValues) {
  const body = jsonData
    ? untransformSchema(JSON.parse(jsonData))
    : buildBody(resource, "create", values);
  const res = await apiFetch(`/api/v1/${resource}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  printJson(data);
}

export async function update(
  resource: Resource,
  id: string,
  jsonData: string | undefined,
  values: CliValues,
) {
  const body = jsonData
    ? untransformSchema(JSON.parse(jsonData))
    : buildBody(resource, "update", values);
  const res = await apiFetch(`/api/v1/${resource}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  printJson(data);
}

export async function del(resource: Resource, id: string) {
  await apiFetch(`/api/v1/${resource}/${id}`, { method: "DELETE" });
  console.log(`Deleted ${resource.slice(0, -1)} ${id}`);
}

export function listConnectionTypes() {
  const entries = Object.entries(ConnectionType) as [string, number][];
  const custom = entries
    .filter(([, v]) => v < 20)
    .map(([k]) => k.toLowerCase())
    .sort();
  const services = entries
    .filter(([, v]) => v >= 20)
    .map(([k]) => k.toLowerCase())
    .sort();
  if (custom.length) process.stdout.write(custom.join("\n") + "\n");
  if (custom.length && services.length) process.stdout.write("\n");
  if (services.length) process.stdout.write(services.join("\n") + "\n");
}
