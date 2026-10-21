import { buildSanitySchemaSyncResult } from "./schema-normalization";
import type { UpdateContfuSchemaOptions } from "./schema-types";

const SCHEMA_SYNC_PATH = "/webhooks/sanity/schema";
const DEFAULT_CONTFU_ORIGIN = "https://contfu.com";

export function updateContfuSchema(options: UpdateContfuSchemaOptions): Promise<Response> {
  const result = buildSanitySchemaSyncResult(
    options.dataset,
    options.schemaTypes,
    options.projectId,
  );
  for (const diagnostic of result.diagnostics) {
    if (options.onDiagnostic) options.onDiagnostic(diagnostic);
    else console.warn("@contfu/sanity schema diagnostic", diagnostic);
  }
  return fetch(getSchemaSyncEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${options.webhookSecret}`,
    },
    body: JSON.stringify(result.payload),
    signal: options.signal,
  });
}

function getSchemaSyncEndpoint(): string {
  const configured = process.env.CONTFU_ORIGIN?.trim() || DEFAULT_CONTFU_ORIGIN;
  return `${configured.replace(/\/$/, "")}${SCHEMA_SYNC_PATH}`;
}
