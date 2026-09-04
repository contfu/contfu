/** Version of the language-neutral Contfu source-push contract. */
export const CONTFU_PUSH_VERSION = 1 as const;
export const CONTFU_PUSH_SIGNATURE_HEADER = "x-contfu-signature";
export const CONTFU_PUSH_MEDIA_TYPE = "application/json";
export const CONTFU_PLUGIN_BOOTSTRAP_EVENT = "contfu.plugin.enabled" as const;

export type ContfuPushOperation = "create" | "update" | "delete";

/** The signed v1 handshake sent by first-party plugins when they start. */
export type ContfuPluginBootstrapPayload = {
  version: typeof CONTFU_PUSH_VERSION;
  event: typeof CONTFU_PLUGIN_BOOTSTRAP_EVENT;
};

/** The fields accepted by the v1 `/webhooks/contfu/{uid}` endpoint. */
export type ContfuPushPayload = {
  version: typeof CONTFU_PUSH_VERSION;
  operation: ContfuPushOperation;
  collectionRef: string;
  itemRef: string;
  parentRef?: string;
  occurredAt?: string;
  /** Durable, monotonically increasing integration-wide sequence (required for gap detection). */
  sequence: number;
  properties?: Record<string, unknown>;
  content?: unknown[];
  sourceEvent?: string;
};

/** Payload input for clients; the contract version is supplied automatically. */
export type ContfuPushInput = Omit<ContfuPushPayload, "version">;
export type WebhookSecret = string | Uint8Array;

export type WebhookFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ContfuWebhookClientOptions = {
  /** Complete endpoint, normally `https://contfu.example/webhooks/contfu/<uid>`. */
  endpoint?: string;
  /** Alias for endpoint, useful when adapting an existing fetch configuration. */
  url?: string;
  secret: WebhookSecret;
  fetch?: WebhookFetch;
};

export type SendSignedBodyOptions = {
  fetch?: WebhookFetch;
  signal?: AbortSignal;
};

/** Error returned when the Contfu endpoint rejects a request. */
export class ContfuWebhookError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly response: Response;

  constructor(response: Response, body: string) {
    super(
      `Contfu webhook request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ""}`,
    );
    this.name = "ContfuWebhookError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = body;
    this.response = response;
  }
}

function secretBytes(secret: WebhookSecret): Uint8Array {
  return typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
}

/** Serialize exactly once, preserving the caller's field insertion order. */
export function serializePayload(payload: ContfuPushInput | ContfuPushPayload): string {
  const { version: _version, ...fields } = payload as ContfuPushPayload;
  return JSON.stringify({ version: CONTFU_PUSH_VERSION, ...fields });
}

/** Return the contract's `sha256=<lowercase hex>` signature for a raw body. */
export async function signPayload(body: string, secret: WebhookSecret): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new Uint8Array(secretBytes(secret)).buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  let hex = "";
  for (const byte of digest) hex += byte.toString(16).padStart(2, "0");
  return `sha256=${hex}`;
}

/** Alias kept short for integrations that only need to sign a custom body. */
export const sign = signPayload;

function resolveEndpoint(options: ContfuWebhookClientOptions): string {
  const endpoint = options.endpoint ?? options.url;
  if (!endpoint) throw new TypeError("A Contfu webhook endpoint is required");
  return endpoint;
}

function resolveFetch(fetcher?: WebhookFetch): WebhookFetch {
  const value = fetcher ?? globalThis.fetch;
  if (!value) throw new Error("This runtime does not provide fetch");
  return value.bind(globalThis);
}

/** Send an already serialized body with the canonical signature and headers. */
export async function sendSignedBody(
  endpoint: string,
  secret: WebhookSecret,
  body: string,
  options: SendSignedBodyOptions = {},
): Promise<Response> {
  const response = await resolveFetch(options.fetch)(endpoint, {
    method: "POST",
    headers: {
      "content-type": CONTFU_PUSH_MEDIA_TYPE,
      [CONTFU_PUSH_SIGNATURE_HEADER]: await signPayload(body, secret),
    },
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    body,
  });
  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw new ContfuWebhookError(response, responseBody);
  }
  return response;
}

/** Serialize, sign, and send one v1 source-push payload. */
export async function sendSignedPayload(
  endpoint: string,
  secret: WebhookSecret,
  payload: ContfuPushInput | ContfuPushPayload,
  options: SendSignedBodyOptions = {},
): Promise<Response> {
  return sendSignedBody(endpoint, secret, serializePayload(payload), options);
}

export class ContfuWebhookClient {
  readonly endpoint: string;
  readonly secret: WebhookSecret;
  readonly fetch?: WebhookFetch;

  constructor(options: ContfuWebhookClientOptions) {
    this.endpoint = resolveEndpoint(options);
    this.secret = options.secret;
    this.fetch = options.fetch;
  }

  push(payload: ContfuPushInput | ContfuPushPayload, signal?: AbortSignal): Promise<Response> {
    return sendSignedPayload(this.endpoint, this.secret, payload, {
      fetch: this.fetch,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  /** Authenticate a first-party plugin without pretending to be a service event. */
  bootstrap(signal?: AbortSignal): Promise<Response> {
    const payload: ContfuPluginBootstrapPayload = {
      version: CONTFU_PUSH_VERSION,
      event: CONTFU_PLUGIN_BOOTSTRAP_EVENT,
    };
    return sendSignedBody(this.endpoint, this.secret, JSON.stringify(payload), {
      fetch: this.fetch,
      ...(signal === undefined ? {} : { signal }),
    });
  }

  send = this.push.bind(this);
}

export function createWebhookClient(options: ContfuWebhookClientOptions): ContfuWebhookClient {
  return new ContfuWebhookClient(options);
}
