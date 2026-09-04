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
  ref: string;
  props: Record<string, unknown>;
};

const RESERVED_FIELDS = new Set(["id", "documentId", "createdAt", "updatedAt", "publishedAt"]);

function camelCase(value: string): string {
  return value.replace(/[-_ ]+([a-zA-Z0-9])/g, (_, character: string) => character.toUpperCase());
}

function normalizeEntry(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  if (!record) return null;
  const attributes = asRecord(record.attributes);
  const normalized: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(attributes ?? {})) {
    normalized[key] = normalizeField(field);
  }
  for (const [key, field] of Object.entries(record)) {
    if (key !== "attributes") normalized[key] = normalizeField(field);
  }
  if (normalized.documentId === undefined && normalized.id !== undefined) {
    normalized.documentId = String(normalized.id);
  }
  return normalized;
}

function normalizeField(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeField);
  const record = asRecord(value);
  if (!record) return value;
  if ("data" in record && (Object.keys(record).length === 1 || "meta" in record)) {
    return normalizeField(record.data);
  }
  const nestedAttributes = asRecord(record.attributes);
  if (nestedAttributes) {
    return normalizeEntry(record);
  }
  return Object.fromEntries(Object.entries(record).map(([key, field]) => [key, normalizeField(field)]));
}

function documentRef(value: Record<string, unknown>): string | null {
  const ref = value.documentId ?? value.id;
  return typeof ref === "string" || typeof ref === "number" ? String(ref) : null;
}

function normalizeProperty(value: unknown, baseUrl: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => normalizeProperty(entry, baseUrl));
  const record = asRecord(value);
  if (!record) return value;
  if (typeof record.url === "string" && typeof record.mime === "string") {
    return {
      ...record,
      url: record.url.startsWith("http") ? record.url : new URL(record.url, baseUrl).toString(),
    };
  }
  const ref = documentRef(record);
  if (ref && !("url" in record)) return Buffer.from(ref, "utf8").toString("base64url");
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, normalizeProperty(entry, baseUrl)]),
  );
}

function parseCanonicalItem(entry: unknown, baseUrl: string, localized: boolean): CanonicalItem | null {
  const normalized = normalizeEntry(entry);
  if (!normalized) return null;
  const ref = documentRef(normalized);
  const createdAt = normalized.createdAt;
  const updatedAt = normalized.updatedAt;
  if (!ref || typeof createdAt !== "string" || typeof updatedAt !== "string") return null;
  const locale = typeof normalized.locale === "string" ? normalized.locale.trim() : "";
  const itemRef = localized && locale ? `${ref}:${locale}` : ref;
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (RESERVED_FIELDS.has(key) || value == null) continue;
    props[camelCase(key)] = normalizeProperty(value, baseUrl);
  }
  props.$createdAt = new Date(createdAt).getTime();
  if (normalized.publishedAt) {
    props.$publishedAt = new Date(String(normalized.publishedAt)).getTime();
  }
  props.$draft = !normalized.publishedAt;
  return { ref: itemRef, props };
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
  const entry = getEntry(data);
  const collection = getModel(data);
  const item = getItemRef(entry);
  if (!collection || !item) {
    strapi.log.warn(
      `[contfu] Skipping ${event}: missing model or item ref in Strapi event payload`,
    );
    strapi.log.debug(`[contfu] Event payload: ${JSON.stringify(data)}`);
    return;
  }

  const entryRecord = asRecord(entry) ?? {};
  const occurredAt =
    typeof entryRecord.updatedAt === "string" ? entryRecord.updatedAt : new Date().toISOString();
  let canonicalItem: CanonicalItem | null = null;
  if (operationFor(event) !== "delete") {
    const normalizedEntry = normalizeEntry(entry);
    canonicalItem = parseCanonicalItem(
      normalizedEntry,
      strapi.config.get<string>("server.url", ""),
      typeof normalizedEntry?.locale === "string" && normalizedEntry.locale.length > 0,
    );
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
    itemRef: canonicalItem?.ref ?? item,
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
