import {
  ConnectionType,
  ConnectionTypeMeta,
  PropertyType,
  schemaType,
  type ServiceCollection,
  type ServiceFlow,
  type ApiConnection,
  type CreateConnectionBody,
  type UpdateConnectionBody,
  type CreateCollectionBody,
  type UpdateCollectionBody,
  type CreateFlowBody,
  type UpdateFlowBody,
  type CollectionSchema,
} from "@contfu/svc-api";
import { getApiClient, handleApiError } from "../http";

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

function buildConnectionCreateBody(values: CliValues): CreateConnectionBody {
  const missing = REQUIRED_CREATE.connections.filter((k) => values[k] === undefined);
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }
  const typeStr = values.type?.toLowerCase() ?? "notion";
  const typeEntry = Object.entries(ConnectionType).find(([k]) => k.toLowerCase() === typeStr);
  const type = typeEntry ? typeEntry[1] : ConnectionType.NOTION;
  return { name: values.name!, type };
}

function buildConnectionUpdateBody(values: CliValues): UpdateConnectionBody {
  const body: UpdateConnectionBody = {};
  if (values.name !== undefined) body.name = values.name;
  if (values["include-ref"] === true) body.includeRef = true;
  if (values["no-include-ref"] === true) body.includeRef = false;
  return body;
}

function buildCollectionCreateBody(values: CliValues): CreateCollectionBody {
  const missing = REQUIRED_CREATE.collections.filter((k) => values[k] === undefined);
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }
  const body: CreateCollectionBody = { displayName: values["display-name"]! };
  if (values.name !== undefined) body.name = values.name;
  if (values["collection-id"] !== undefined) body.connectionId = Number(values["collection-id"]);
  if (values["include-ref"] === true) body.includeRef = true;
  if (values["no-include-ref"] === true) body.includeRef = false;
  return body;
}

function buildCollectionUpdateBody(values: CliValues): UpdateCollectionBody {
  const body: UpdateCollectionBody = {};
  if (values.name !== undefined) body.name = values.name;
  if (values["display-name"] !== undefined) body.displayName = values["display-name"];
  if (values["include-ref"] === true) body.includeRef = true;
  if (values["no-include-ref"] === true) body.includeRef = false;
  return body;
}

function buildFlowCreateBody(values: CliValues): CreateFlowBody {
  const missing = REQUIRED_CREATE.flows.filter((k) => values[k] === undefined);
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }
  const body: CreateFlowBody = {
    sourceId: Number(values["source-id"]),
    targetId: Number(values["target-id"]),
  };
  if (values["include-ref"] === true) body.includeRef = true;
  if (values["no-include-ref"] === true) body.includeRef = false;
  return body;
}

function buildFlowUpdateBody(values: CliValues): UpdateFlowBody {
  const body: UpdateFlowBody = {};
  if (values["include-ref"] === true) body.includeRef = true;
  if (values["no-include-ref"] === true) body.includeRef = false;
  return body;
}

const PROPERTY_TYPE_LABEL: Record<number, string> = Object.fromEntries(
  Object.entries(PropertyType).map(([k, v]) => [v, k.toLowerCase()]),
);

const PROPERTY_TYPE_VALUE: Record<string, number> = Object.fromEntries(
  Object.entries(PropertyType).map(([k, v]) => [k.toLowerCase(), v]),
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

function transformSchema(schema: CollectionSchema): Record<string, string> {
  return Object.fromEntries(
    Object.entries(schema).map(([prop, value]) => {
      const type = schemaType(value);
      const label = PROPERTY_TYPE_LABEL[type] ?? String(type);
      const enumVals = Array.isArray(value) ? value[1] : undefined;
      return [prop, enumVals && enumVals.length > 0 ? `${label}(${enumVals.join("|")})` : label];
    }),
  );
}

function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

type Column<T> = { key: keyof T & string; header: string; format?: (v: unknown) => string };

const CONNECTION_COLUMNS: Column<ApiConnection>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  {
    key: "type",
    header: "Type",
    format: (v) => ConnectionTypeMeta[v as number]?.label ?? String(v),
  },
  { key: "accountId", header: "Account", format: (v) => (v as string | null) ?? "" },
  { key: "hasCredentials", header: "Credentials", format: (v) => (v ? "yes" : "no") },
];

const COLLECTION_COLUMNS: Column<ServiceCollection>[] = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "displayName", header: "Display Name" },
  {
    key: "connectionId",
    header: "Connection",
    format: (v) => (v == null ? "" : String(v as number)),
  },
];

const FLOW_COLUMNS: Column<ServiceFlow>[] = [
  { key: "id", header: "ID" },
  { key: "sourceId", header: "Source" },
  { key: "targetId", header: "Target" },
  { key: "includeRef", header: "Ref", format: (v) => (v ? "yes" : "no") },
];

function printTable<T extends Record<string, unknown>>(rows: T[], columns: Column<T>[]) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  const cell = (col: Column<T>, row: T) =>
    col.format ? col.format(row[col.key]) : String((row[col.key] as string) ?? "");
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
  const client = getApiClient();
  try {
    if (resource === "connections") {
      const data = await client.listConnections();
      if (format === "json") printJson(data);
      else printTable(data, CONNECTION_COLUMNS);
    } else if (resource === "collections") {
      const data = await client.listCollections();
      if (format === "json") {
        printJson(data.map((c) => ({ ...c, schema: c.schema ? transformSchema(c.schema) : null })));
      } else {
        printTable(data, COLLECTION_COLUMNS);
      }
    } else {
      const data = await client.listFlows();
      if (format === "json") printJson(data);
      else printTable(data, FLOW_COLUMNS);
    }
  } catch (err) {
    handleApiError(err);
  }
}

export async function get(resource: Resource, id: string) {
  const client = getApiClient();
  try {
    if (resource === "connections") {
      printJson(await client.getConnection(id));
    } else if (resource === "collections") {
      const data = await client.getCollection(id);
      printJson({ ...data, schema: data.schema ? transformSchema(data.schema) : null });
    } else {
      printJson(await client.getFlow(id));
    }
  } catch (err) {
    handleApiError(err);
  }
}

export async function create(resource: Resource, jsonData: string | undefined, values: CliValues) {
  const client = getApiClient();
  try {
    if (resource === "connections") {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateConnectionBody)
        : buildConnectionCreateBody(values);
      printJson(await client.createConnection(body));
    } else if (resource === "collections") {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateCollectionBody)
        : buildCollectionCreateBody(values);
      printJson(await client.createCollection(body));
    } else {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateFlowBody)
        : buildFlowCreateBody(values);
      printJson(await client.createFlow(body));
    }
  } catch (err) {
    handleApiError(err);
  }
}

export async function update(
  resource: Resource,
  id: string,
  jsonData: string | undefined,
  values: CliValues,
) {
  const client = getApiClient();
  try {
    if (resource === "connections") {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateConnectionBody)
        : buildConnectionUpdateBody(values);
      printJson(await client.updateConnection(id, body));
    } else if (resource === "collections") {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateCollectionBody)
        : buildCollectionUpdateBody(values);
      printJson(await client.updateCollection(id, body));
    } else {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateFlowBody)
        : buildFlowUpdateBody(values);
      printJson(await client.updateFlow(id, body));
    }
  } catch (err) {
    handleApiError(err);
  }
}

export async function del(resource: Resource, id: string) {
  const client = getApiClient();
  try {
    if (resource === "connections") {
      await client.deleteConnection(id);
    } else if (resource === "collections") {
      await client.deleteCollection(id);
    } else {
      await client.deleteFlow(id);
    }
    console.log(`Deleted ${resource.slice(0, -1)} ${id}`);
  } catch (err) {
    handleApiError(err);
  }
}

export function listConnectionTypes() {
  const entries = Object.entries(ConnectionType);
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
