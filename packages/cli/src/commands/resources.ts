import {
  IntegrationCapability,
  IntegrationRole,
  SyncMode,
  isCreatableIntegrationType,
} from "@contfu/core";
import {
  IntegrationType,
  IntegrationTypeMeta,
  PropertyType,
  canonicalizeBcp47,
  propertyTypeBase,
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
import { BASE_URL, getApiClient, handleCliError } from "../http";
import { writeEnvKey, ensureGitignore } from "../env";
import { isStructuredOutputFormat, printStructured, type StructuredOutputFormat } from "../output";
import { printTable, terminalLink, type TableColumn } from "../table";
import { printDryRun, type DryRunOption } from "./dry-run";
import { enumFallback, translateEnum } from "./presentation";

const RESOURCES = ["integrations", "collections", "flows"] as const;
export type Resource = (typeof RESOURCES)[number];

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
  username?: string;
  "application-password"?: string;
  "contentful-api-mode"?: string;
  "contentful-delivery-token"?: string;
  "contentful-preview-token"?: string;
  "contentful-management-token"?: string;
  "project-id"?: string;
  scope?: string;
  scopes?: string;
  "webhook-secret"?: string;
  "webhook-header"?: string;
  "webhook-max-attempts"?: string;
  "webhook-delivery-window"?: string;
  "generate-key"?: boolean;
  "i18n-locales"?: string;
  "i18n-active-locales"?: string;
  "i18n-locale-map"?: string;
  "i18n-locale-field"?: string;
  "i18n-keep-raw-field"?: boolean;
  "i18n-drop-raw-field"?: boolean;
  "i18n-grouping-key"?: string;
  "reset-i18n"?: boolean;
  "include-drafts"?: boolean;
  "no-include-drafts"?: boolean;
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
  if (values["i18n-locale-map"] !== undefined) {
    i18n.localeMap = parseLocaleMap(values["i18n-locale-map"]);
    const activeLocales =
      i18n.activeLocales?.mode === "custom" ? i18n.activeLocales.locales : i18n.locales;
    if (activeLocales !== undefined) {
      const locales = new Set(activeLocales);
      const invalid = Object.values(i18n.localeMap).find((locale) => !locales.has(locale));
      if (invalid)
        throw new Error(`--i18n-locale-map value must be one of active locales: ${invalid}`);
    }
  }
  if (Object.keys(i18n).length > 0) body.i18n = i18n;
}

function validateCollectionContentFlags(values: CliValues) {
  if (values.content === true && values["no-content"] === true) {
    throw new Error(`Use only one of --content or --no-content`);
  }
}

function validateFallbackGroupingKey(key: string): void {
  if (key.startsWith("$")) {
    throw new Error("Fallback grouping key must be a normal collection property");
  }
}

function hasBasicIntegrationCredentials(values: CliValues): boolean {
  return values.username !== undefined || values["application-password"] !== undefined;
}

function applyIntegrationCredentials(
  body: CreateIntegrationBody | UpdateIntegrationBody,
  values: CliValues,
) {
  const hasBasicCredentials = hasBasicIntegrationCredentials(values);
  if (hasBasicCredentials && values.token !== undefined) {
    throw new Error(`Use either --token or --username/--application-password`);
  }
  if (hasBasicCredentials) {
    if (!values.username || !values["application-password"]) {
      throw new Error(`--username and --application-password must be used together`);
    }
    body.credentials = Buffer.from(
      `${values.username}:${values["application-password"]}`,
      "utf-8",
    ).toString("base64");
    return;
  }
  if (values.token !== undefined) body.credentials = values.token;
}

function parseContentfulApiMode(value: string | undefined): "delivery" | "preview" | undefined {
  if (value === undefined) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "delivery" || normalized === "preview") return normalized;
  throw new Error(`--contentful-api-mode must be delivery or preview`);
}

function hasContentfulCredentialFlags(values: CliValues): boolean {
  return (
    values["contentful-delivery-token"] !== undefined ||
    values["contentful-preview-token"] !== undefined ||
    values["contentful-management-token"] !== undefined
  );
}

function hasContentfulSettings(values: CliValues): boolean {
  return values["contentful-api-mode"] !== undefined || hasContentfulCredentialFlags(values);
}

function applyContentfulIntegrationSettings(
  body: CreateIntegrationBody | UpdateIntegrationBody,
  values: CliValues,
  options: { creating?: boolean } = {},
) {
  if (hasBasicIntegrationCredentials(values)) {
    throw new Error(`Contentful integrations use token credentials, not username/password`);
  }
  const apiMode = parseContentfulApiMode(values["contentful-api-mode"]);
  if (apiMode !== undefined) body.opts = { ...body.opts, apiMode };

  const hasSpecificCredentials = hasContentfulCredentialFlags(values);
  if (!hasSpecificCredentials) {
    if (apiMode === "preview" && values.token !== undefined) {
      body.credentials = JSON.stringify({ previewToken: values.token });
    } else if (values.token !== undefined) {
      body.credentials = values.token;
    }
  } else {
    if (values.token !== undefined && values["contentful-delivery-token"] !== undefined) {
      throw new Error(`Use either --token or --contentful-delivery-token`);
    }
    const credentials = {
      deliveryToken: values["contentful-delivery-token"] ?? values.token,
      previewToken: values["contentful-preview-token"],
      managementToken: values["contentful-management-token"],
    };
    body.credentials = JSON.stringify(
      Object.fromEntries(Object.entries(credentials).filter(([, value]) => value !== undefined)),
    );
  }

  if (options.creating === true && apiMode === "preview" && body.credentials === undefined) {
    throw new Error(`Contentful preview mode requires --contentful-preview-token or --token`);
  }
}

function applyIntegrationDraftFlags(
  body: CreateIntegrationBody | UpdateIntegrationBody,
  values: CliValues,
) {
  if (values["include-drafts"] === true && values["no-include-drafts"] === true) {
    throw new Error(`Use only one of --include-drafts or --no-include-drafts`);
  }
  if (values["include-drafts"] === true) body.opts = { ...body.opts, includeDrafts: true };
  if (values["no-include-drafts"] === true) body.opts = { ...body.opts, includeDrafts: false };
}

function hasWebhookTargetOptions(values: CliValues): boolean {
  return (
    values["webhook-header"] !== undefined ||
    values["webhook-max-attempts"] !== undefined ||
    values["webhook-delivery-window"] !== undefined
  );
}

function parsePositiveIntegerFlag(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parseWebhookHeaders(value: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const entry of value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf("=");
    if (separator <= 0) throw new Error(`--webhook-header entries must use Name=Value`);
    const name = entry.slice(0, separator).trim();
    const headerValue = entry.slice(separator + 1).trim();
    if (!name) throw new Error(`--webhook-header entries must include a header name`);
    headers[name] = headerValue;
  }
  return headers;
}

function applyWebhookTargetOptions(
  body: CreateIntegrationBody | UpdateIntegrationBody,
  values: CliValues,
) {
  if (!hasWebhookTargetOptions(values)) return;
  const opts: NonNullable<CreateIntegrationBody["opts"]> = {};
  if (values["webhook-header"] !== undefined) {
    opts.headers = parseWebhookHeaders(values["webhook-header"]);
  }
  if (values["webhook-max-attempts"] !== undefined) {
    opts.maxAttempts = parsePositiveIntegerFlag(
      values["webhook-max-attempts"],
      "--webhook-max-attempts",
    );
  }
  if (values["webhook-delivery-window"] !== undefined) {
    opts.deliveryWindow = parsePositiveIntegerFlag(
      values["webhook-delivery-window"],
      "--webhook-delivery-window",
    );
  }
  body.opts = { ...body.opts, ...opts };
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
  if (values["i18n-grouping-key"] !== undefined) {
    const key = values["i18n-grouping-key"] || undefined;
    if (key !== undefined) validateFallbackGroupingKey(key);
    i18n.key = key;
  }
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
  if (!typeEntry) {
    throw new Error(
      `Unknown integration type: ${values.type}. Run \`contfu integrations types\` to list supported types.`,
    );
  }
  const type = typeEntry[1];
  if (!isCreatableIntegrationType(type)) {
    throw new Error(
      `Integration type ${values.type} is not currently available. Run \`contfu integrations types\` to list supported types.`,
    );
  }
  const body: CreateIntegrationBody = { name: values.name!, type };
  if (values.url !== undefined) body.url = values.url;
  if (type === IntegrationType.CONTENTFUL) {
    applyContentfulIntegrationSettings(body, values, { creating: true });
  } else {
    applyIntegrationCredentials(body, values);
  }
  if (values["webhook-secret"] !== undefined) body.webhookSecret = values["webhook-secret"];
  if (hasWebhookTargetOptions(values) && type !== IntegrationType.WEBHOOK) {
    throw new Error(`Webhook target options require --type webhook`);
  }
  applyWebhookTargetOptions(body, values);
  const scopes = parseScopeFlags(values);
  if (scopes !== undefined) body.scopes = scopes;
  if (type === IntegrationType.CONTENTFUL && values.url !== undefined) {
    body.url = null;
    body.opts = {
      ...body.opts,
      spaceId: values.url,
    };
  }
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
  applyIntegrationDraftFlags(body, values);
  applyIntegrationI18n(body, values);
  return body;
}

function buildIntegrationUpdateBody(values: CliValues): UpdateIntegrationBody {
  const body: UpdateIntegrationBody = {};
  if (values.name !== undefined) body.name = values.name;
  if (hasContentfulSettings(values)) {
    applyContentfulIntegrationSettings(body, values);
  } else {
    applyIntegrationCredentials(body, values);
  }
  if (values["webhook-secret"] !== undefined) body.webhookSecret = values["webhook-secret"];
  applyWebhookTargetOptions(body, values);
  const scopes = parseScopeFlags(values);
  if (scopes !== undefined) body.scopes = scopes;
  applyIntegrationDraftFlags(body, values);
  applyIntegrationI18n(body, values);
  return body;
}

function buildCollectionCreateBody(values: CliValues): CreateCollectionBody {
  validateCollectionContentFlags(values);
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
  validateCollectionContentFlags(values);
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
  const type = propertyTypeBase(schemaType(value as never)) & ~PropertyType.NULL;
  const scalarTypes: readonly number[] = [
    PropertyType.STRING,
    PropertyType.NUMBER,
    PropertyType.BOOLEAN,
    PropertyType.DATE,
    PropertyType.PLAINDATE,
    PropertyType.ENUM,
  ];
  return scalarTypes.includes(type);
}

function localeFieldSchemaValue(field: string): number | undefined {
  if (field === "$locale") return PropertyType.STRING;
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
    const value =
      schema[field] ?? (label === "Locale property" ? localeFieldSchemaValue(field) : undefined);
    if (value === undefined) throw new Error(`${label} not found in collection schema: ${field}`);
    if (!isScalarSchemaValue(value))
      throw new Error(`${label} must be a scalar schema field: ${field}`);
  }
}

function transformSchema(schema: CollectionSchema): Record<string, string> {
  return Object.fromEntries(
    Object.entries(schema).map(([prop, value]) => {
      const type = propertyTypeBase(schemaType(value)) & ~PropertyType.NULL;
      const label = PROPERTY_TYPE_LABEL[type] ?? String(type);
      const enumVals = Array.isArray(value) ? value[1] : undefined;
      return [prop, enumVals && enumVals.length > 0 ? `${label}(${enumVals.join("|")})` : label];
    }),
  );
}

function printJson(data: unknown) {
  printStructured(data, "json");
}

function printData(data: unknown, format: StructuredOutputFormat, full: boolean, compact: unknown) {
  printStructured(data, format, { full, compact });
}

function translateIntegrationType(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value;
  return IntegrationTypeMeta[value as IntegrationType]?.label ?? enumFallback(value);
}

function translateSyncMode(value: unknown): string[] {
  if (typeof value !== "number") return [enumFallback(value)];
  if (value === SyncMode.NONE) return ["none"];
  const labels: string[] = [];
  if ((value & SyncMode.POLL) !== 0) labels.push("poll");
  if ((value & SyncMode.WEBHOOK) !== 0) labels.push("webhook");
  const known = SyncMode.POLL | SyncMode.WEBHOOK;
  const unknownBits = value & ~known;
  if (unknownBits !== 0) labels.push(enumFallback(unknownBits));
  return labels.length > 0 ? labels : [enumFallback(value)];
}

function translateIntegrationRoles(values: unknown): string[] {
  return Array.isArray(values)
    ? values
        .map((value) => translateEnum(value, IntegrationRole))
        .map((label) => label.replace(/-role$/, ""))
    : [];
}

function translateIntegrationCapabilities(values: unknown): string[] {
  return Array.isArray(values)
    ? values.map((value) => translateEnum(value, IntegrationCapability))
    : [];
}

// These collection enums are owned by the service backend and intentionally are
// kept as a CLI presentation mapping rather than importing backend internals.
const COLLECTION_SOURCE_SYNC_STATUS = {
  ACTIVE: 0,
  EXPLICIT_PAUSED: 1,
  QUOTA_BLOCKED: 2,
  NEEDS_FULL_PULL: 3,
  REPAIR_FAILED: 4,
};
const COLLECTION_STALE_REASON = { QUOTA_BLOCKED: 1 };
const FLOW_STATE = {
  ACTIVE: 0,
  FROZEN: 1,
  CREDENTIAL_BLOCKED: 2,
  CAPABILITY_BLOCKED: 3,
  QUOTA_BLOCKED: 4,
};

function presentIntegration(integration: ApiIntegration) {
  return {
    ...integration,
    ...(integration.type !== undefined ? { type: translateIntegrationType(integration.type) } : {}),
    ...(integration.mode !== undefined ? { mode: translateSyncMode(integration.mode) } : {}),
    ...(integration.roles !== undefined
      ? { roles: translateIntegrationRoles(integration.roles) }
      : {}),
    ...(integration.capabilities !== undefined
      ? { capabilities: translateIntegrationCapabilities(integration.capabilities.enabled) }
      : {}),
  };
}

function compactIntegration(integration: ApiIntegration) {
  const presented = presentIntegration(integration);
  return {
    id: presented.id,
    name: presented.name,
    type: integration.type === undefined ? String(integration.type) : presented.type,
    ...(integration.mode !== undefined ? { mode: presented.mode } : {}),
    ...(integration.roles !== undefined ? { roles: presented.roles } : {}),
    ...(integration.capabilities !== undefined ? { capabilities: presented.capabilities } : {}),
    ...(presented.scopes?.length > 0 ? { scopes: presented.scopes } : {}),
    hasCredentials: presented.hasCredentials,
  };
}

function compactIntegrations(integrations: ApiIntegration[]) {
  return integrations.map(compactIntegration);
}

function presentCollection(collection: ServiceCollection) {
  return {
    ...collection,
    ...(collection.integrationType !== undefined
      ? { integrationType: translateIntegrationType(collection.integrationType) }
      : {}),
    ...(collection.sourceSyncStatus !== undefined
      ? {
          sourceSyncStatus: translateEnum(
            collection.sourceSyncStatus,
            COLLECTION_SOURCE_SYNC_STATUS,
          ),
        }
      : {}),
    ...(collection.staleReason !== undefined
      ? {
          staleReason:
            collection.staleReason === null
              ? null
              : translateEnum(collection.staleReason, COLLECTION_STALE_REASON),
        }
      : {}),
    ...(collection.schema !== undefined
      ? { schema: collection.schema ? transformSchema(collection.schema) : null }
      : {}),
  };
}

function compactCollection(collection: ServiceCollection) {
  const presented = presentCollection(collection);
  return {
    id: presented.id,
    name: presented.name,
    displayName: presented.displayName,
    integrationId: presented.integrationId,
    integrationType: presented.integrationType,
    itemsCount: presented.itemsCount,
    flowSourceCount: presented.flowSourceCount,
    flowTargetCount: presented.flowTargetCount,
    stale: presented.stale,
    sourceSyncStatus: presented.sourceSyncStatus,
    staleReason: presented.staleReason,
  };
}

function compactCollections(collections: ServiceCollection[]) {
  return collections.map(compactCollection);
}

function presentFlow(flow: ServiceFlow) {
  const detailed = flow as ServiceFlow & {
    sourceIntegrationType?: unknown;
    targetIntegrationType?: unknown;
  };
  return {
    ...flow,
    state: translateEnum(flow.state, FLOW_STATE),
    ...(detailed.sourceIntegrationType !== undefined
      ? { sourceIntegrationType: translateIntegrationType(detailed.sourceIntegrationType) }
      : {}),
    ...(detailed.targetIntegrationType !== undefined
      ? { targetIntegrationType: translateIntegrationType(detailed.targetIntegrationType) }
      : {}),
  };
}

function compactFlows(flows: ServiceFlow[]) {
  return flows.map(({ id, sourceId, targetId }) => ({ id, sourceId, targetId }));
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
  return `${BASE_URL.replace(/\/+$/, "")}${path}`;
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

export async function list(resource: Resource, format: string, full = false) {
  const client = getApiClient();
  try {
    if (resource === "integrations") {
      const data = await client.listIntegrations();
      if (isStructuredOutputFormat(format)) {
        printData(data.map(presentIntegration), format, full, compactIntegrations(data));
      } else printTable(data, INTEGRATION_COLUMNS);
    } else if (resource === "collections") {
      const data = await client.listCollections();
      if (isStructuredOutputFormat(format)) {
        printData(data.map(presentCollection), format, full, compactCollections(data));
      } else {
        printTable(data, COLLECTION_COLUMNS);
      }
    } else {
      const data = await client.listFlows();
      if (isStructuredOutputFormat(format))
        printData(data.map(presentFlow), format, full, compactFlows(data));
      else printTable(data, FLOW_COLUMNS);
    }
  } catch (err) {
    handleCliError(err);
  }
}

export async function get(resource: Resource, id: string, format = "default", full = false) {
  const client = getApiClient();
  try {
    if (resource === "integrations") {
      const resolvedId = await resolveIntegrationRef(id, client);
      const data = await client.getIntegration(resolvedId);
      if (isStructuredOutputFormat(format)) {
        printData(presentIntegration(data), format, full, compactIntegration(data));
      } else printJson(data);
    } else if (resource === "collections") {
      const resolvedId = await resolveCollectionRef(id, client);
      const data = await client.getCollection(resolvedId);
      if (isStructuredOutputFormat(format))
        printData(presentCollection(data), format, full, compactCollection(data));
      else printJson({ ...data, schema: data.schema ? transformSchema(data.schema) : null });
    } else {
      const data = await client.getFlow(id);
      if (isStructuredOutputFormat(format))
        printData(presentFlow(data), format, full, compactFlows([data])[0]);
      else printJson(data);
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
        ? (untransformSchema(JSON.parse(jsonData)) as Partial<CreateFlowBody>)
        : buildFlowCreateBody(values);
      if (jsonData) {
        if (values["source-id"] !== undefined) body.sourceId = values["source-id"];
        if (values["target-id"] !== undefined) body.targetId = values["target-id"];
      }
      const missing = [
        ["source-id", body.sourceId],
        ["target-id", body.targetId],
      ].filter(([, value]) => value === undefined);
      if (missing.length > 0) {
        console.error(
          `Missing required flag(s): ${missing.map(([flag]) => `--${flag}`).join(", ")}`,
        );
        process.exit(1);
      }
      if (!jsonData || values["source-id"] !== undefined || values["target-id"] !== undefined) {
        const collections = await client.listCollections();
        if (!jsonData || values["source-id"] !== undefined) {
          body.sourceId = resolveCollectionRefFromRows(body.sourceId!, collections);
        }
        if (!jsonData || values["target-id"] !== undefined) {
          body.targetId = resolveCollectionRefFromRows(body.targetId!, collections);
        }
      }
      const createBody = body as CreateFlowBody;
      if (options.dryRun) {
        printDryRun("create flow", createBody);
        return;
      }
      printJson(await client.createFlow(createBody));
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
      if (!jsonData && body.opts !== undefined) {
        const existing = await client.getIntegration(resolvedId);
        if (hasWebhookTargetOptions(values) && existing.type !== IntegrationType.WEBHOOK) {
          throw new Error(`Webhook target options can only update webhook integrations`);
        }
        body.opts = { ...existing.opts, ...body.opts };
      }
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
  const entries = Object.entries(IntegrationType).filter(([, type]) =>
    isCreatableIntegrationType(type),
  );
  const custom = entries
    .filter(([, type]) => type < 20)
    .map(([name]) => name.toLowerCase())
    .sort();
  const services = entries
    .filter(([, type]) => type >= 20)
    .map(([name]) => name.toLowerCase())
    .sort();
  if (custom.length) process.stdout.write(custom.join("\n") + "\n");
  if (custom.length && services.length) process.stdout.write("\n");
  if (services.length) process.stdout.write(services.join("\n") + "\n");
}
