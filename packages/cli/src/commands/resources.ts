import {
  IntegrationType,
  IntegrationTypeMeta,
  PropertyType,
  canonicalizeBcp47,
  schemaType,
  type ServiceCollection,
  type ServiceFlow,
  type ApiIntegration,
  type CreateIntegrationBody,
  type UpdateIntegrationBody,
  type CreateCollectionBody,
  type UpdateCollectionBody,
  type CreateFlowBody,
  type UpdateFlowBody,
  type CollectionSchema,
  type ContfuApiClient,
  type CollectionI18nConfig,
  type IntegrationI18nConfig,
} from "@contfu/svc-api";
import { getApiClient, getBaseUrl, handleCliError } from "../http";
import { writeEnvKey, ensureGitignore } from "../env";
import { printTable, terminalLink, type TableColumn } from "../table";
import { printDryRun, type DryRunOption } from "./dry-run";

const RESOURCES = ["integrations", "collections", "flows"] as const;
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
  "integration-id"?: string;
  content?: boolean;
  "no-content"?: boolean;
  token?: string;
  "project-id"?: string;
  scope?: string;
  scopes?: string;
  "webhook-secret"?: string;
  "generate-key"?: boolean;
  "i18n-locales"?: string;
  "i18n-active-locales"?: string;
  "i18n-locale-map"?: string;
  "i18n-locale-field"?: string;
  "i18n-keep-raw-field"?: boolean;
  "i18n-drop-raw-field"?: boolean;
  "i18n-grouping-key"?: string;
  "reset-i18n"?: boolean;
}

const REQUIRED_CREATE: Record<Resource, (keyof CliValues)[]> = {
  integrations: ["name"],
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

function parseLocaleList(value: string, flag: string): string[] {
  const locales = value
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean)
    .map((locale) => {
      const canonical = canonicalizeBcp47(locale);
      if (!canonical) throw new Error(`${flag} contains invalid BCP 47 locale: ${locale}`);
      return canonical;
    });
  return [...new Set(locales)];
}

function parseLocaleMap(value: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf("=");
    if (separator <= 0 || separator === entry.length - 1) {
      throw new Error(`--i18n-locale-map entries must use raw=locale`);
    }
    const raw = entry.slice(0, separator).trim();
    const locale = entry.slice(separator + 1).trim();
    const canonical = canonicalizeBcp47(locale);
    if (!canonical) throw new Error(`--i18n-locale-map contains invalid BCP 47 locale: ${locale}`);
    map[raw] = canonical;
  }
  return map;
}

function applyIntegrationI18n(
  body: CreateIntegrationBody | UpdateIntegrationBody,
  values: CliValues,
) {
  if (values["reset-i18n"] === true) {
    body.i18n = { locales: undefined, localeMap: undefined, activeLocales: { mode: "inherit" } };
    return;
  }
  const i18n: NonNullable<IntegrationI18nConfig> = {};
  if (values["i18n-locales"] !== undefined) {
    i18n.locales = parseLocaleList(values["i18n-locales"], "--i18n-locales");
  }
  if (values["i18n-locale-map"] !== undefined) {
    i18n.localeMap = parseLocaleMap(values["i18n-locale-map"]);
    if (i18n.locales && i18n.locales.length > 0) {
      const locales = new Set(i18n.locales);
      const invalid = Object.values(i18n.localeMap).find((locale) => !locales.has(locale));
      if (invalid)
        throw new Error(`--i18n-locale-map value must be one of --i18n-locales: ${invalid}`);
    }
  }
  if (values["i18n-active-locales"] !== undefined) {
    const value = values["i18n-active-locales"].trim();
    if (value === "inherit") i18n.activeLocales = { mode: "inherit" };
    else if (value.startsWith("custom:")) {
      i18n.activeLocales = {
        mode: "custom",
        locales: parseLocaleList(value.slice(7), "--i18n-active-locales"),
      };
    } else {
      throw new Error(`--i18n-active-locales must be inherit or custom:<locales>`);
    }
  }
  if (Object.keys(i18n).length > 0) body.i18n = i18n;
}

function applyCollectionI18n(body: CreateCollectionBody | UpdateCollectionBody, values: CliValues) {
  if (values["reset-i18n"] === true) {
    body.i18n = {
      localeField: undefined,
      localeMap: undefined,
      keepLocaleField: undefined,
      key: undefined,
    };
    return;
  }
  const i18n: NonNullable<CollectionI18nConfig> = {};
  if (values["i18n-locale-field"] !== undefined)
    i18n.localeField = values["i18n-locale-field"] || undefined;
  if (values["i18n-locale-map"] !== undefined)
    i18n.localeMap = parseLocaleMap(values["i18n-locale-map"]);
  if (values["i18n-keep-raw-field"] === true && values["i18n-drop-raw-field"] === true) {
    throw new Error(`Use only one of --i18n-keep-raw-field or --i18n-drop-raw-field`);
  }
  if (values["i18n-keep-raw-field"] === true) i18n.keepLocaleField = true;
  if (values["i18n-drop-raw-field"] === true) i18n.keepLocaleField = false;
  if (values["i18n-grouping-key"] !== undefined)
    i18n.key = values["i18n-grouping-key"] || undefined;
  if (Object.keys(i18n).length > 0) body.i18n = i18n;
}

function buildIntegrationCreateBody(values: CliValues): CreateIntegrationBody {
  const missing = REQUIRED_CREATE.integrations.filter((k) => values[k] === undefined);
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(", ")}`);
    process.exit(1);
  }
  const typeStr = values.type?.toLowerCase() ?? "notion";
  const typeEntry = Object.entries(IntegrationType).find(([k]) => k.toLowerCase() === typeStr);
  const type = typeEntry ? typeEntry[1] : IntegrationType.NOTION;
  const body: CreateIntegrationBody = { name: values.name!, type };
  if (values.url !== undefined) body.url = values.url;
  if (values.token !== undefined) body.credentials = values.token;
  if (values["webhook-secret"] !== undefined) body.webhookSecret = values["webhook-secret"];
  const scopes = parseScopeFlags(values);
  if (scopes !== undefined) body.scopes = scopes;
  if (type === IntegrationType.SANITY) {
    if (!values["project-id"]) {
      console.error("Missing required flag: --project-id");
      process.exit(1);
    }
    body.url = `https://${values["project-id"]}.api.sanity.io`;
    body.opts = {
      projectId: values["project-id"],
    };
  }
  applyIntegrationI18n(body, values);
  return body;
}

function buildIntegrationUpdateBody(values: CliValues): UpdateIntegrationBody {
  const body: UpdateIntegrationBody = {};
  if (values.name !== undefined) body.name = values.name;
  const scopes = parseScopeFlags(values);
  if (scopes !== undefined) body.scopes = scopes;
  applyIntegrationI18n(body, values);
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
  if (values["integration-id"] !== undefined) body.integrationId = values["integration-id"];
  if (values.content === true) body.includeContent = true;
  if (values["no-content"] === true) body.includeContent = false;
  applyCollectionI18n(body, values);
  return body;
}

function buildCollectionUpdateBody(values: CliValues): UpdateCollectionBody {
  const body: UpdateCollectionBody = {};
  if (values.name !== undefined) body.name = values.name;
  if (values["display-name"] !== undefined) body.displayName = values["display-name"];
  if (values.content === true) body.includeContent = true;
  if (values["no-content"] === true) body.includeContent = false;
  applyCollectionI18n(body, values);
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

function isScalarSchemaValue(value: unknown): boolean {
  if (value === undefined) return false;
  const type = schemaType(value as never);
  const scalarTypes: readonly number[] = [
    PropertyType.STRING,
    PropertyType.NUMBER,
    PropertyType.BOOLEAN,
    PropertyType.DATE,
    PropertyType.ENUM,
  ];
  return scalarTypes.includes(type);
}

function systemScalarSchemaValue(field: string): number | undefined {
  if (field === "$locale") return PropertyType.STRING;
  if (field === "$draft") return PropertyType.BOOLEAN;
  return undefined;
}

function validateCollectionI18nFields(collection: ServiceCollection, body: UpdateCollectionBody) {
  if (!body.i18n || !collection.schema) return;
  const schema = collection.schema;
  for (const [label, field] of [
    ["Locale property", body.i18n.localeField],
    ["Fallback Grouping Key", body.i18n.key],
  ] as const) {
    if (field === undefined) continue;
    const value = schema[field] ?? systemScalarSchemaValue(field);
    if (value === undefined) throw new Error(`${label} not found in collection schema: ${field}`);
    if (!isScalarSchemaValue(value))
      throw new Error(`${label} must be a scalar schema field: ${field}`);
  }
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

export async function resolveIntegrationRef(
  ref: string,
  client: Pick<ContfuApiClient, "listIntegrations"> = getApiClient(),
): Promise<string> {
  const integrations = await client.listIntegrations();
  return resolveUniqueResource(
    integrations,
    ref,
    (integration) => integration.name === ref,
    "Integration",
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

type ApiIntegrationRow = ApiIntegration & { displayName?: string | null };
type ServiceFlowRow = ServiceFlow & {
  sourceCollectionName?: string | null;
  targetCollectionName?: string | null;
};

function appUrl(path: string): string {
  return `${getBaseUrl().replace(/\/+$/, "")}${path}`;
}

function resourceLink(kind: "integrations" | "collections", id: string): string {
  return terminalLink(id, appUrl(`/${kind}/${encodeURIComponent(id)}`));
}

const INTEGRATION_COLUMNS: TableColumn<ApiIntegrationRow>[] = [
  { header: "ID", value: (row) => resourceLink("integrations", row.id) },
  { header: "Name", value: (row) => row.name },
  { header: "Display Name", value: (row) => row.displayName ?? row.name },
  {
    header: "Type",
    value: (row) => IntegrationTypeMeta[row.type as IntegrationType]?.label ?? String(row.type),
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
    header: "Integration",
    value: (row) =>
      typeof row.integrationId === "string" || typeof row.integrationId === "number"
        ? resourceLink("integrations", String(row.integrationId))
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
    if (resource === "integrations") {
      const data = await client.listIntegrations();
      if (format === "json") printJson(data);
      else printTable(data, INTEGRATION_COLUMNS);
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
    if (resource === "integrations") {
      const resolvedId = await resolveIntegrationRef(id, client);
      printJson(await client.getIntegration(resolvedId));
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
  options: DryRunOption = {},
) {
  const client = getApiClient();
  try {
    if (resource === "integrations") {
      if (values["generate-key"]) {
        const name = values.name;
        if (!name) {
          console.error("Missing required flag: --name");
          process.exit(1);
        }
        if (options.dryRun) {
          printDryRun("create app integration and write CONTFU_KEY", {
            name,
            envFile: envFile ?? ".env",
          });
          return;
        }
        const result = await client.createAppIntegration(name);
        printJson(result);
        writeEnvKey(envFile ?? ".env", result.apiKey);
        ensureGitignore();
        return;
      }
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateIntegrationBody)
        : buildIntegrationCreateBody(values);
      if (options.dryRun) {
        printDryRun("create integration", body);
        return;
      }
      printJson(await client.createIntegration(body));
    } else if (resource === "collections") {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as CreateCollectionBody)
        : buildCollectionCreateBody(values);
      if (!jsonData && body.integrationId != null) {
        body.integrationId = await resolveIntegrationRef(body.integrationId, client);
      }
      if (options.dryRun) {
        printDryRun("create collection", body);
        return;
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
      if (options.dryRun) {
        printDryRun("create flow", body);
        return;
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
  options: DryRunOption = {},
) {
  const client = getApiClient();
  try {
    if (resource === "integrations") {
      const resolvedId = await resolveIntegrationRef(id, client);
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateIntegrationBody)
        : buildIntegrationUpdateBody(values);
      if (options.dryRun) {
        printDryRun("update integration", { id: resolvedId, body });
        return;
      }
      printJson(await client.updateIntegration(resolvedId, body));
    } else if (resource === "collections") {
      const resolvedId = await resolveCollectionRef(id, client);
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateCollectionBody)
        : buildCollectionUpdateBody(values);
      if (!jsonData && body.i18n) {
        validateCollectionI18nFields(await client.getCollection(resolvedId), body);
      }
      if (options.dryRun) {
        printDryRun("update collection", { id: resolvedId, body });
        return;
      }
      printJson(await client.updateCollection(resolvedId, body));
    } else {
      const body = jsonData
        ? (untransformSchema(JSON.parse(jsonData)) as UpdateFlowBody)
        : buildFlowUpdateBody(values);
      if (options.dryRun) {
        printDryRun("update flow", { id, body });
        return;
      }
      printJson(await client.updateFlow(id, body));
    }
  } catch (err) {
    handleCliError(err);
  }
}

export async function del(resource: Resource, id: string, options: DryRunOption = {}) {
  const client = getApiClient();
  try {
    let resolvedId = id;
    if (resource === "integrations") {
      resolvedId = await resolveIntegrationRef(id, client);
      if (options.dryRun) {
        printDryRun("delete integration", { id: resolvedId });
        return;
      }
      await client.deleteIntegration(resolvedId);
    } else if (resource === "collections") {
      resolvedId = await resolveCollectionRef(id, client);
      if (options.dryRun) {
        printDryRun("delete collection", { id: resolvedId });
        return;
      }
      await client.deleteCollection(resolvedId);
    } else {
      if (options.dryRun) {
        printDryRun("delete flow", { id });
        return;
      }
      await client.deleteFlow(id);
    }
    console.log(`Deleted ${resource.slice(0, -1)} ${resolvedId}`);
  } catch (err) {
    handleCliError(err);
  }
}

export async function regenerateAppKey(id: string, envFile?: string, options: DryRunOption = {}) {
  const client = getApiClient();
  try {
    const resolvedId = await resolveIntegrationRef(id, client);
    if (options.dryRun) {
      printDryRun("regenerate app key and write CONTFU_KEY", {
        id: resolvedId,
        envFile: envFile ?? ".env",
      });
      return;
    }
    const result = await client.regenerateAppKey(resolvedId);
    writeEnvKey(envFile ?? ".env", result.apiKey);
    ensureGitignore();
  } catch (err) {
    handleCliError(err);
  }
}

export function listIntegrationTypes() {
  const entries = Object.entries(IntegrationType);
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
