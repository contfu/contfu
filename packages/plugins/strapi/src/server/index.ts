import crypto from "node:crypto";

const BOOTSTRAP_EVENT = "contfu.plugin.enabled";
const EVENTS = [
  "entry.create",
  "entry.update",
  "entry.delete",
  "entry.publish",
  "entry.unpublish",
] as const;

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
  eventHub: {
    on(event: string, handler: (data: unknown) => void | Promise<void>): void;
  };
};

type PluginConfig = {
  webhookUrl?: string;
  webhookSecret?: string;
};

function sign(body: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
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

async function sendSignedPayload(
  strapi: StrapiLike,
  event: string,
  payload: Record<string, unknown>,
  config: Required<PluginConfig>,
): Promise<void> {
  const body = JSON.stringify(payload);
  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-strapi-event": event,
      "x-strapi-signature": sign(body, config.webhookSecret),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    strapi.log.warn(`[contfu] Webhook failed: ${response.status} ${response.statusText} ${text}`);
  }
}

async function sendContfuWebhook(
  strapi: StrapiLike,
  event: string,
  data: unknown,
  config: Required<PluginConfig>,
): Promise<void> {
  const payload = {
    event,
    createdAt: new Date().toISOString(),
    model: getModel(data),
    entry: getEntry(data),
  };

  if (!payload.model || !payload.entry) {
    strapi.log.warn(`[contfu] Skipping ${event}: missing model or entry in Strapi event payload`);
    strapi.log.debug(`[contfu] Event payload: ${JSON.stringify(data)}`);
    return;
  }

  await sendSignedPayload(strapi, event, payload, config);
}

async function sendBootstrapWebhook(
  strapi: StrapiLike,
  config: Required<PluginConfig>,
): Promise<void> {
  const now = new Date().toISOString();
  await sendSignedPayload(
    strapi,
    BOOTSTRAP_EVENT,
    {
      event: BOOTSTRAP_EVENT,
      createdAt: now,
      model: "contfu-plugin",
      uid: "plugin::contfu.strapi",
      entry: {
        id: 0,
        documentId: "contfu-strapi-plugin",
        createdAt: now,
        updatedAt: now,
        package: "@contfu/strapi",
      },
    },
    config,
  );
}

export = () => ({
  register() {},

  bootstrap({ strapi }: { strapi: StrapiLike }) {
    const config = strapi.config.get<PluginConfig>("plugin.contfu", {});

    if (!config.webhookUrl || !config.webhookSecret) {
      strapi.log.warn("[contfu] webhookUrl or webhookSecret is missing; signed webhooks disabled");
      return;
    }

    for (const event of EVENTS) {
      strapi.eventHub.on(event, async (data) => {
        try {
          await sendContfuWebhook(strapi, event, data, {
            webhookUrl: config.webhookUrl!,
            webhookSecret: config.webhookSecret!,
          });
        } catch (error) {
          strapi.log.error(`[contfu] Failed to send ${event} webhook`, error);
        }
      });
    }

    void sendBootstrapWebhook(strapi, {
      webhookUrl: config.webhookUrl,
      webhookSecret: config.webhookSecret,
    }).then(
      () => {
        strapi.log.info(`[contfu] Successfully connected to contfu`);
      },
      (error) => {
        strapi.log.error(`[contfu] Failed to send ${BOOTSTRAP_EVENT} webhook`, error);
      },
    );
  },
});
