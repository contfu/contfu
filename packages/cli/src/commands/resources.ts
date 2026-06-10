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
  type ContfuApiClient,
} from "@contfu/svc-api";
import { getApiClient, getBaseUrl, handleCliError } from "../http";
import { writeEnvKey, ensureGitignore } from "../env";
import { printTable, terminalLink, type TableColumn } from "../table";

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
  "connection-id"?: string;
  content?: boolean;
  "no-content"?: boolean;
  token?: string;
  "project-id"?: string;
  scope?: string;
  scopes?: string;
  "webhook-secret"?: string;
  "generate-key"?: boolean;
}

const REQUIRED_CREATE: Record<Resource, (keyof CliValues)[]> = {
  connections: ["name"],
  collections: ["display-name"],
  flows: ["source-id", "target-id"],
};

function parseScopeFlags(values: CliValues): string[] | undefined {
  if (values.scopes !== undefined) {
    return values.scopes
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }
  return values.scope !== undefined ? [values.scope] : undefined;
}

function buildConnectionCreateBody(values: CliValues): CreateConnectionBody {
  const missing = REQUIRED_CREATE.connections.filter((k) => values[k] === undefined);
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }
  const typeStr = values.type?.toLowerCase() ?? "notion";
  const typeEntry = Object.entries(ConnectionType).find(([k]) => k.toLowerCase() === typeStr);
  const type = typeEntry ? typeEntry[1] : ConnectionType.NOTION;
  const body: CreateConnectionBody = { name: values.name!, type };
  if (values.url !== undefined) body.url = values.url;
  if (values.token !== undefined) body.credentials = values.token;
  if (values["webhook-secret"] !== undefined) body.webhookSecret = values["webhook-secret"];
  const scopes = parseScopeFlags(values);
  if (scopes !== undefined) body.scopes = scopes;
  if (type === ConnectionType.SANITY) {
    if (!values["project-id"]) {
      console.error("Missing required flag: --project-id");
      process.exit(1);
    }
    body.url = `https://${values["project-id"]}.api.sanity.io`;
    body.opts = {
      projectId: values["project-id"],
    };
  }
  return body;
}

function buildConnectionUpdateBody(values: CliValues): UpdateConnectionBody {
  const body: UpdateConnectionBody = {};
  if (values.name !== undefined) body.name = values.name;
  const scopes = parseScopeFlags(values);
  if (scopes !== undefined) body.scopes = scopes;
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
  if (values["connection-id"] !== undefined) body.connectionId = values["connection-id"];
  if (values.content === true) body.includeContent = true;
  if (values["no-content"] === true) body.includeContent = false;
  return body;
}

function buildCollectionUpdateBody(values: CliValues): UpdateCollectionBody {
  const body: UpdateCollectionBody = {};
  if (values.name !== undefined) body.name = values.name;
  if (values["display-name"] !== undefined) body.displayName = values["display-name"];
  if (values.content === true) body.includeContent = true;
  if (values["no-content"] === true) body.includeContent = false;
  return body;
}

function buildFlowCreateBody(values: CliValues): CreateFlowBody {
  const missing = REQUIRED_CREATE.flows.filter((k) => values[k] === undefined);
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }
  const body: CreateFlowBody = {
    sourceId: values["source-id"]!,
    targetId: values["target-id"]!,
  };
  return body;
}

function buildFlowUpdateBody(_values: CliValues): UpdateFlowBody {
  return {};
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

function uniqueById<T extends { id: unknown }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [String(row.id), row])).values()];
}

function resolveUniqueResource<T extends { id: unknown }>(
  rows: T[],
  ref: string,
  isNameMatch: (row: T) => boolean,
  label: string,
): string {
  const byId = rows.find((row) => String(row.id) === ref);
  if (byId) return String(byId.id);

  const byName = uniqueById(rows.filter(isNameMatch));
  if (byName.length === 1) return String(byName[0].id);
  if (byName.length > 1) throw new Error(`${label} name is ambiguous; use the ${label} id`);
  throw new Error(`${label} not found: ${ref}`);
}

export async function resolveConnectionRef(
  ref: string,
  client: Pick<ContfuApiClient, "listConnections"> = getApiClient(),
): Promise<string> {
  const connections = await client.listConnections();
  return resolveUniqueResource(
    connections,
    ref,
    (connection) => connection.name === ref,
    "Connection",
  );
}

export async function resolveCollectionRef(
  ref: string,
  client: Pick<ContfuApiClient, "listCollections"> = getApiClient(),
): Promise<string> {
  const collections = await client.listCollections();
  return resolveCollectionRefFromRows(ref, collections);
}

function resolveCollectionRefFromRows(ref: string, collections: ServiceCollection[]): string {
  return resolveUniqueResource(
    collections,
    ref,
    (collection) => collection.name === ref || collection.displayName === ref,
    "Collection",
  );
}

type ApiConnectionRow = ApiConnection & { displayName?: string | null };
type ServiceFlowRow = ServiceFlow & {
  sourceCollectionName?: string | null;
  targetCollectionName?: string | null;
};

function appUrl(path: string): string {
  return `${getBaseUrl().replace(/\/+$/, "")}${path}`;
}

function resourceLink(kind: "connections" | "collections", id: string): string {
  return terminalLink(id, appUrl(`/${kind}/${encodeURIComponent(id)}`));
}

const CONNECTION_COLUMNS: TableColumn<ApiConnectionRow>[] = [
  { header: "ID", value: (row) => resourceLink("connections", row.id) },
  { header: "Name", value: (row) => row.name },
  { header: "Display Name", value: (row) => row.displayName ?? row.name },
  {
    header: "Type",
    value: (row) => ConnectionTypeMeta[row.type as ConnectionType]?.label ?? String(row.type),
  },
  { header: "Account", value: (row) => row.accountId ?? "" },
  { header: "Scopes", value: (row) => row.scopes?.join(", ") ?? "" },
  { header: "Credentials", value: (row) => (row.hasCredentials ? "yes" : "no") },
];

const COLLECTION_COLUMNS: TableColumn<ServiceCollection>[] = [
  { header: "ID", value: (row) => resourceLink("collections", row.id) },
  { header: "Name", value: (row) => row.name },
  { header: "Display Name", value: (row) => row.displayName },
  { header: "Scope", value: (row) => row.scope ?? "" },
  { header: "Items", value: (row) => row.itemsCount },
  {
    header: "Connection",
    value: (row) =>
      typeof row.connectionId === "string" || typeof row.connectionId === "number"
        ? resourceLink("connections", String(row.connectionId))
        : "",
  },
];

function collectionRefLabel(id: string, name?: string | null): string {
  const label = name ? `(${id}) ${name}` : id;
  return terminalLink(label, appUrl(`/collections/${encodeURIComponent(id)}`));
}

const FLOW_COLUMNS: TableColumn<ServiceFlowRow>[] = [
  { header: "ID", value: (row) => row.id },
  { header: "Source", value: (row) => collectionRefLabel(row.sourceId, row.sourceCollectionName) },
  { header: "Target", value: (row) => collectionRefLabel(row.targetId, row.targetCollectionName) },
];

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
    handleCliError(err);
  }
}

export async function get(resource: Resource, id: string) {
  const client = getApiClient();
  try {
    if (resource === "connections") {
      const resolvedId = await resolveConnectionRef(id, client);
      printJson(await client.getConnection(resolvedId));
    } else if (resource === "collections") {
      const resolvedId = await resolveCollectionRef(id, client);
      const data = await client.getCollection(resolvedId);
      printJson({ ...data, schema: data.schema ? transformSchema(data.schema) : null });
    } else {
      printJson(await client.getFlow(id));
    }
  } catch (err) {
    handleCliError(err);
  }
}

export async function create(
  resource: Resource,
  jsonData: string | undefined,
  values: CliValues,
  envFile?: string,
) {
  const client = getApiClient();
  try {
    if (resource === "connections") {
      if (values["generate-key"]) {
        const name = values.name;
        if (!name) {
          console.error("Missing required flag: --name");
          process.exit(1);
        }
        const result = await client.createAppConnection(name);
        printJson(result);
        writeEnvKey(envFile ?? ".env", result.apiKey);
        ensureGitignore();
        return;
      }
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateConnectionBody)
        : buildConnectionCreateBody(values);
      printJson(await client.createConnection(body));
    } else if (resource === "collections") {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateCollectionBody)
        : buildCollectionCreateBody(values);
      if (!jsonData && body.connectionId != null) {
        body.connectionId = await resolveConnectionRef(body.connectionId, client);
      }
      printJson(await client.createCollection(body));
    } else {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateFlowBody)
        : buildFlowCreateBody(values);
      if (!jsonData) {
        const collections = await client.listCollections();
        body.sourceId = resolveCollectionRefFromRows(body.sourceId, collections);
        body.targetId = resolveCollectionRefFromRows(body.targetId, collections);
      }
      printJson(await client.createFlow(body));
    }
  } catch (err) {
    handleCliError(err);
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
      const resolvedId = await resolveConnectionRef(id, client);
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateConnectionBody)
        : buildConnectionUpdateBody(values);
      printJson(await client.updateConnection(resolvedId, body));
    } else if (resource === "collections") {
      const resolvedId = await resolveCollectionRef(id, client);
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateCollectionBody)
        : buildCollectionUpdateBody(values);
      printJson(await client.updateCollection(resolvedId, body));
    } else {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateFlowBody)
        : buildFlowUpdateBody(values);
      printJson(await client.updateFlow(id, body));
    }
  } catch (err) {
    handleCliError(err);
  }
}

export async function del(resource: Resource, id: string) {
  const client = getApiClient();
  try {
    let resolvedId = id;
    if (resource === "connections") {
      resolvedId = await resolveConnectionRef(id, client);
      await client.deleteConnection(resolvedId);
    } else if (resource === "collections") {
      resolvedId = await resolveCollectionRef(id, client);
      await client.deleteCollection(resolvedId);
    } else {
      await client.deleteFlow(id);
    }
    console.log(`Deleted ${resource.slice(0, -1)} ${resolvedId}`);
  } catch (err) {
    handleCliError(err);
  }
}

export async function regenerateAppKey(id: string, envFile?: string) {
  const client = getApiClient();
  try {
    const resolvedId = await resolveConnectionRef(id, client);
    const result = await client.regenerateAppKey(resolvedId);
    writeEnvKey(envFile ?? ".env", result.apiKey);
    ensureGitignore();
  } catch (err) {
    handleCliError(err);
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
