import {
  CONTFU_PLUGIN_BOOTSTRAP_EVENT,
  ContfuWebhookError,
  createWebhookClient,
  sendSignedBody,
  serializePayload,
  type ContfuWebhookClient,
} from "@contfu/webhook";

const EVENTS = [
  "entry.create",
  "entry.update",
  "entry.delete",
  "entry.publish",
  "entry.unpublish",
] as const;
const SEQUENCE_STORE_NAME = "contfu";
const SEQUENCE_STORE_KEY = "push-sequence";

type PersistentStore = {
  get(options: { key: string }): Promise<unknown>;
  set(options: { key: string; value: unknown }): Promise<void>;
};

type OutboxRecord = { sequence: number; body: string };
type SequenceState = { sequence: number; outbox: Record<string, OutboxRecord> };

type StrapiAttribute = {
  type?: string;
  target?: unknown;
  component?: string;
  components?: string[];
};

type StrapiModel = {
  attributes?: Record<string, StrapiAttribute>;
};

type StrapiLike = {
  log: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
  };
  config: {
    get<T>(key: string, fallback: T): T;
  };
  store?: (options: { type: "plugin"; name: string }) => PersistentStore;
  /** Strapi's model registry, used to qualify relation destination UIDs in webhook payloads. */
  contentType?: (uid: string) => StrapiModel | null;
  /** Strapi's database query API, used to re-read lifecycle entries with deep population. */
  db?: {
    query(uid: string): {
      findOne(params: {
        where: Record<string, unknown>;
        populate: Record<string, unknown>;
      }): Promise<unknown>;
    };
  };
  eventHub: {
    on(event: string, handler: (data: unknown) => void | Promise<void>): void;
  };
};

type PluginConfig = {
  webhookUrl?: string;
  webhookSecret?: string;
};

function operationFor(event: string): "create" | "update" | "delete" {
  if (event === "entry.create" || event === "entry.publish") return "create";
  if (event === "entry.delete") return "delete";
  return "update";
}

function getItemRef(entry: unknown): string | null {
  const record = asRecord(entry);
  if (!record) return null;
  const ref = record.documentId ?? record.id;
  if (typeof ref !== "string" && typeof ref !== "number") return null;
  const locale = typeof record.locale === "string" && record.locale ? `:${record.locale}` : "";
  return `${String(ref)}${locale}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getNested(data: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = data;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function getEntry(data: unknown): unknown {
  const record = asRecord(data);
  if (!record) return null;
  return (
    record.entry ?? record.result ?? record.entity ?? getNested(record, ["params", "data"]) ?? null
  );
}

function getModel(data: unknown): string | null {
  const record = asRecord(data);
  if (!record) return null;
  const model = record.uid ?? record.model ?? getNested(record, ["contentType", "uid"]);
  return typeof model === "string" && model.length > 0 ? model : null;
}

type CanonicalItem = {
  ref: Buffer;
  props: Record<string, unknown>;
  content?: unknown[];
};

const RESERVED_FIELDS = new Set(["id", "documentId", "createdAt", "updatedAt", "publishedAt"]);
const STRAPI_REF_PREFIX = Buffer.from("strapi-ref:v1\0", "utf8");

function normalizeStrapiWebhookEntry(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  return record ? normalizeStrapiEntity(record) : null;
}

function normalizeStrapiEntity(record: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const attributes = asRecord(record.attributes);
  for (const [key, value] of Object.entries(attributes ?? {})) {
    normalized[key] = normalizeStrapiField(value);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key !== "attributes") normalized[key] = normalizeStrapiField(value);
  }
  if (normalized.documentId === undefined && normalized.id !== undefined) {
    normalized.documentId = String(normalized.id);
  }
  return normalized;
}

function normalizeStrapiField(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeStrapiField);
  const record = asRecord(value);
  if (!record) return value;
  if ("data" in record && Object.keys(record).every((key) => key === "data" || key === "meta")) {
    const data = record.data;
    if (Array.isArray(data)) return data.map((entry) => normalizeStrapiField(entry));
    const entity = asRecord(data);
    return entity ? normalizeStrapiEntity(entity) : normalizeStrapiField(data);
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, normalizeStrapiField(entry)]),
  );
}

function strapiDocumentRef(value: Record<string, unknown>): string | null {
  const ref = value.documentId ?? value.id;
  return typeof ref === "string" || typeof ref === "number" ? String(ref) : null;
}

function encodeStrapiScopedRef(contentTypeUid: string, ref: Buffer): Buffer {
  const uid = Buffer.from(contentTypeUid.trim(), "utf8");
  if (uid.length === 0) return ref;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(uid.length, 0);
  return Buffer.concat([STRAPI_REF_PREFIX, length, uid, ref]);
}

function normalizeStrapiProperty(
  value: unknown,
  baseUrl: string,
  relationTargetUid?: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeStrapiProperty(entry, baseUrl, relationTargetUid));
  }
  const record = asRecord(value);
  if (!record) return value;

  if (typeof record.__component === "string") {
    const props: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (key !== "id" && key !== "__component") {
        props[key] = normalizeStrapiProperty(entry, baseUrl);
      }
    }
    return ["x", record.__component, props, []];
  }

  if (typeof record.url === "string" && typeof record.mime === "string") {
    return {
      ...record,
      url: record.url.startsWith("http")
        ? record.url
        : baseUrl
          ? new URL(record.url, baseUrl).toString()
          : record.url,
    };
  }

  const ref = strapiDocumentRef(record);
  if (ref && !("url" in record)) {
    const rawRef = Buffer.from(
      typeof record.locale === "string" && record.locale ? `${ref}:${record.locale}` : ref,
      "utf8",
    );
    return (relationTargetUid ? encodeStrapiScopedRef(relationTargetUid, rawRef) : rawRef).toString(
      "base64url",
    );
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      normalizeStrapiProperty(entry, baseUrl, relationTargetUid),
    ]),
  );
}

function parseStrapiItemData(
  entry: unknown,
  options: { baseUrl: string; localized: boolean; relationTargets?: Record<string, string> },
): CanonicalItem | null {
  const normalized = normalizeStrapiWebhookEntry(entry);
  if (!normalized) return null;
  const ref = strapiDocumentRef(normalized);
  const createdAt = normalized.createdAt;
  const updatedAt = normalized.updatedAt;
  if (!ref || typeof createdAt !== "string" || typeof updatedAt !== "string") return null;
  const locale = typeof normalized.locale === "string" ? normalized.locale.trim() : "";
  const itemRef = options.localized && locale ? `${ref}:${locale}` : ref;
  const props: Record<string, unknown> = {};
  let content: unknown[] | undefined;
  for (const [key, value] of Object.entries(normalized)) {
    if (RESERVED_FIELDS.has(key) || value == null) continue;
    const parsed = normalizeStrapiProperty(
      value,
      options.baseUrl,
      options.relationTargets?.[key] ??
        options.relationTargets?.[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)],
    );
    props[key.replace(/[-_ ]+([a-zA-Z0-9])/g, (_, character: string) => character.toUpperCase())] =
      parsed;
    if (
      Array.isArray(parsed) &&
      parsed.every((block) => Array.isArray(block) && block[0] === "x")
    ) {
      content ??= parsed;
    }
  }
  props.$createdAt = new Date(createdAt).getTime();
  props.$draft = !normalized.publishedAt;
  if (normalized.publishedAt)
    props.$publishedAt = new Date(String(normalized.publishedAt)).getTime();
  return { ref: Buffer.from(itemRef, "utf8"), props, content };
}

function getRelationTargets(
  strapi: StrapiLike,
  collection: string,
): Record<string, string> | undefined {
  const attributes = strapi.contentType?.(collection)?.attributes;
  if (!attributes) return undefined;
  const targets: Record<string, string> = {};
  for (const [field, attribute] of Object.entries(attributes)) {
    const target = typeof attribute.target === "string" ? attribute.target.trim() : "";
    if (attribute.type === "relation" && target) targets[field] = target;
  }
  return Object.keys(targets).length > 0 ? targets : undefined;
}

/**
 * Mirror Strapi's deep-populate shape for lifecycle re-reads. In particular,
 * dynamic zones need `on` fragments or Strapi returns only component IDs.
 */
function deepPopulate(
  strapi: StrapiLike,
  uid: string,
  visited: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  if (visited.has(uid)) return {};
  const attributes = strapi.contentType?.(uid)?.attributes;
  if (!attributes) return {};
  const nextVisited = new Set(visited);
  nextVisited.add(uid);
  const populate: Record<string, unknown> = {};

  for (const [name, attribute] of Object.entries(attributes)) {
    if (attribute.type === "relation") {
      populate[name] = {};
    } else if (attribute.type === "media") {
      populate[name] = { select: ["*"] };
    } else if (attribute.type === "component" && attribute.component) {
      populate[name] = {
        populate: deepPopulate(strapi, attribute.component, nextVisited),
      };
    } else if (attribute.type === "dynamiczone") {
      const components: Record<string, unknown> = {};
      for (const componentUid of attribute.components ?? []) {
        components[componentUid] = {
          populate: deepPopulate(strapi, componentUid, nextVisited),
        };
      }
      populate[name] = { on: components };
    }
  }

  return populate;
}

async function hydrateEntry(
  strapi: StrapiLike,
  collection: string,
  entry: unknown,
): Promise<unknown> {
  if (!strapi.db) return entry;
  const record = asRecord(entry);
  const rawId = record?.id;
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string" && /^\d+$/.test(rawId)
        ? Number(rawId)
        : NaN;
  if (!Number.isSafeInteger(id)) return entry;

  const hydrated = await strapi.db.query(collection).findOne({
    where: { id },
    populate: deepPopulate(strapi, collection),
  });
  if (hydrated == null) {
    throw new Error(`Could not re-read Strapi entry ${collection}:${id} for webhook delivery`);
  }
  return hydrated;
}

function deliveryKey(event: string, collection: string, item: string): string {
  // A lifecycle event has no portable id in Strapi's event hub. This key is deliberately
  // independent of timestamps so a reconstructed retry can recover its exact outbox body.
  return JSON.stringify([event, collection, item]);
}

function readSequenceState(value: unknown): SequenceState {
  const record = asRecord(value);
  const sequence = record && typeof record.sequence === "number" ? record.sequence : 0;
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Stored Contfu webhook sequence is invalid");
  }
  const outbox: Record<string, OutboxRecord> = {};
  const storedOutbox = record && asRecord(record.outbox);
  for (const [key, candidate] of Object.entries(storedOutbox ?? {})) {
    if (
      asRecord(candidate) &&
      typeof candidate.sequence === "number" &&
      Number.isSafeInteger(candidate.sequence) &&
      candidate.sequence > 0 &&
      typeof candidate.body === "string"
    ) {
      outbox[key] = { sequence: candidate.sequence, body: candidate.body };
    }
  }
  return { sequence, outbox };
}

function createOrderedSender(
  strapi: StrapiLike,
  client: ContfuWebhookClient,
): (event: string, data: unknown) => Promise<void> {
  let pending = Promise.resolve();
  return (event, data) => {
    // Strapi invokes lifecycle handlers concurrently. Keep allocation, persistence, and
    // transmission in one queue so the receiver never observes sequence 2 before 1.
    const next = pending.then(() => sendContfuWebhook(strapi, event, data, client));
    pending = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}

async function sendContfuWebhook(
  strapi: StrapiLike,
  event: string,
  data: unknown,
  client: ContfuWebhookClient,
): Promise<void> {
  const rawEntry = getEntry(data);
  const collection = getModel(data);
  const entry =
    collection && operationFor(event) !== "delete"
      ? await hydrateEntry(strapi, collection, rawEntry)
      : rawEntry;
  const item = getItemRef(entry);
  if (!collection || !item) {
    strapi.log.warn(
      `[contfu] Skipping ${event}: missing model or item ref in Strapi event payload`,
    );
    strapi.log.debug(`[contfu] Event payload: ${JSON.stringify(data)}`);
    return;
  }

  const entryRecord = asRecord(entry) ?? {};
  const relationTargets = getRelationTargets(strapi, collection);
  const occurredAt =
    typeof entryRecord.updatedAt === "string" ? entryRecord.updatedAt : new Date().toISOString();
  let canonicalItem: ReturnType<typeof parseStrapiItemData> | null = null;
  if (operationFor(event) !== "delete") {
    const normalizedEntry = normalizeStrapiWebhookEntry(entry);
    if (
      normalizedEntry &&
      (typeof normalizedEntry.id === "number" || typeof normalizedEntry.id === "string") &&
      typeof normalizedEntry.createdAt === "string" &&
      typeof normalizedEntry.updatedAt === "string"
    ) {
      canonicalItem = parseStrapiItemData(normalizedEntry as never, {
        collection: 0,
        baseUrl: strapi.config.get<string>("server.url", ""),
        localized: typeof normalizedEntry.locale === "string" && normalizedEntry.locale.length > 0,
        includeDrafts: true,
        relationTargets,
      });
    }
  }
  if (!strapi.store) throw new Error("Strapi persistent store is unavailable");
  const store = strapi.store({ type: "plugin", name: SEQUENCE_STORE_NAME });
  const key = deliveryKey(event, collection, item);
  let state = readSequenceState(await store.get({ key: SEQUENCE_STORE_KEY }));
  const deliver = async (body: string): Promise<boolean> => {
    try {
      await sendSignedBody(client.endpoint, client.secret, body, { fetch: client.fetch });
      return true;
    } catch (error) {
      if (error instanceof ContfuWebhookError) {
        strapi.log.warn(
          `[contfu] Webhook failed: ${error.status} ${error.statusText} ${error.body}`,
        );
        return false;
      }
      throw error;
    }
  };

  // Flush durable deliveries before allocating a later sequence. This matters when a request
  // failed after sequence allocation: a later lifecycle event must not overtake that outbox row.
  const pendingOutbox = Object.entries(state.outbox).sort(
    ([, left], [, right]) => left.sequence - right.sequence,
  );
  const retriedCurrent = state.outbox[key] !== undefined;
  for (const [outboxKey, record] of pendingOutbox) {
    if (!(await deliver(record.body))) return;
    const remaining = { ...state.outbox };
    delete remaining[outboxKey];
    state = { sequence: state.sequence, outbox: remaining };
    await store.set({ key: SEQUENCE_STORE_KEY, value: state });
  }
  if (retriedCurrent) return;

  const sequence = state.sequence + 1;
  const payload = {
    version: 1 as const,
    operation: operationFor(event),
    sourceEvent: event,
    collectionRef: collection,
    itemRef: canonicalItem?.ref.toString("utf8") ?? item,
    occurredAt,
    sequence,
    ...(operationFor(event) === "delete"
      ? {}
      : {
          properties: canonicalItem?.props ?? {},
          ...(canonicalItem?.content === undefined ? {} : { content: canonicalItem.content }),
        }),
  };
  const body = serializePayload(payload);
  const queuedState: SequenceState = {
    sequence,
    outbox: { ...state.outbox, [key]: { sequence, body } },
  };
  // Persist the complete canonical body before transmission. A process restart can therefore
  // retry the same sequence and bytes, even when Strapi supplies a new event object.
  await store.set({ key: SEQUENCE_STORE_KEY, value: queuedState });
  if (!(await deliver(body))) return;

  // A successful delivery can be removed after transmission. If this write fails, retaining
  // the outbox causes a harmless exact duplicate on the next retry.
  const remaining = { ...queuedState.outbox };
  delete remaining[key];
  await store.set({ key: SEQUENCE_STORE_KEY, value: { sequence, outbox: remaining } });
}

export = () => ({
  register() {},

  bootstrap({ strapi }: { strapi: StrapiLike }) {
    const config = strapi.config.get<PluginConfig>("plugin.contfu", {});

    if (!config.webhookUrl || !config.webhookSecret) {
      strapi.log.warn("[contfu] webhookUrl or webhookSecret is missing; signed webhooks disabled");
      return;
    }

    const client = createWebhookClient({
      endpoint: config.webhookUrl,
      secret: config.webhookSecret,
    });
    const sendOrdered = createOrderedSender(strapi, client);

    for (const event of EVENTS) {
      strapi.eventHub.on(event, async (data) => {
        try {
          await sendOrdered(event, data);
        } catch (error) {
          strapi.log.error(`[contfu] Failed to send ${event} webhook`, error);
        }
      });
    }

    void client.bootstrap().then(
      () => {
        strapi.log.info(`[contfu] Successfully connected to contfu`);
      },
      (error) => {
        if (error instanceof ContfuWebhookError) {
          strapi.log.error(
            `[contfu] Failed to send ${CONTFU_PLUGIN_BOOTSTRAP_EVENT} webhook: ${error.status} ${error.statusText} ${error.body}`,
          );
        } else {
          strapi.log.error(
            `[contfu] Failed to send ${CONTFU_PLUGIN_BOOTSTRAP_EVENT} webhook`,
            error,
          );
        }
      },
    );
  },
});
