import {
  ApiError,
  SourceOperationStatus,
  type ApiSourceOperation,
  type FullResyncResult,
  type ContfuApiClient,
} from "@contfu/svc-api";
import { getApiClient, handleCliError } from "../http";
import { isStructuredOutputFormat, printStructured, type OutputFormat } from "../output";
import { printDryRun } from "./dry-run";
import { resolveCollectionRef } from "./resources";

const OPERATION_STATUS = SourceOperationStatus;

export type CollectionOperationAction =
  | "sync-now"
  | "full-refresh"
  | "full-resync"
  | "pause"
  | "resume"
  | "operations";

interface Options {
  format: OutputFormat;
  full?: boolean;
  dryRun?: boolean;
  wait?: boolean;
  refreshSourceFirst?: boolean;
}

function printResult(result: unknown, options: Options): void {
  if (isStructuredOutputFormat(options.format))
    printStructured(result, options.format, { full: options.full });
  else if (Array.isArray(result)) printOperationList(result as ApiSourceOperation[]);
  else if (isOperation(result)) printOperation(result);
  else console.log(JSON.stringify(result, null, 2));
}

function isOperation(value: unknown): value is ApiSourceOperation {
  return !!value && typeof value === "object" && "operation" in value && "status" in value;
}

function operationName(operation: number): string {
  if (operation === 1) return "Sync now";
  if (operation === 2) return "Full refresh";
  return `Operation ${operation}`;
}

function statusName(status: number): string {
  return (
    Object.entries(OPERATION_STATUS).find(([, value]) => value === status)?.[0] ?? String(status)
  );
}

function operationDiagnostic(operation: ApiSourceOperation): string | undefined {
  if (!operation.diagnostics || typeof operation.diagnostics !== "object") return undefined;
  const message = (operation.diagnostics as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

function printOperation(operation: ApiSourceOperation): void {
  console.log(`${operationName(operation.operation)}  ${statusName(operation.status)}`);
  console.log(`  id: ${operation.id}  collection: ${operation.collectionId}`);
  if (operation.failureCategory) console.log(`  failure: ${operation.failureCategory}`);
  const diagnostic = operationDiagnostic(operation);
  if (diagnostic) console.log(`  diagnostics: ${diagnostic}`);
}

function printOperationList(operations: ApiSourceOperation[]): void {
  if (operations.length === 0) {
    console.log("No source operations found.");
    return;
  }
  for (const [index, operation] of operations.entries()) {
    if (index > 0) console.log();
    printOperation(operation);
  }
}

const POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function isRetryablePollingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || error.status >= 500);
}

function pollingDelayMs(retryCount: number, error?: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs != null) {
    // Retry-After is server guidance, not ordinary exponential backoff. The
    // caller still clamps the sleep to its local deadline.
    return Math.max(POLL_INTERVAL_MS, error.retryAfterMs);
  }
  const backoff = Math.min(MAX_POLL_INTERVAL_MS, POLL_INTERVAL_MS * 2 ** retryCount);
  // Keep retries from synchronizing across CLI processes while bounding the
  // additional delay to a small fraction of the poll budget.
  return backoff + Math.floor(Math.random() * Math.min(250, backoff / 4));
}

async function waitForOperation(
  client: Pick<ContfuApiClient, "getSourceOperation">,
  operation: ApiSourceOperation,
): Promise<ApiSourceOperation> {
  let current = operation;
  let retryCount = 0;
  let nextDelay = POLL_INTERVAL_MS;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (
    current.status !== OPERATION_STATUS.COMPLETED &&
    current.status !== OPERATION_STATUS.FAILED &&
    current.status !== OPERATION_STATUS.BLOCKED
  ) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for source operation ${operation.id}`);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(nextDelay, deadline - Date.now())));
    try {
      current = await client.getSourceOperation(current.id);
      retryCount = 0;
      nextDelay = POLL_INTERVAL_MS;
    } catch (error) {
      if (!isRetryablePollingError(error)) throw error;
      nextDelay = pollingDelayMs(retryCount++, error);
    }
  }
  return current;
}

async function waitForFullResync(
  client: Pick<ContfuApiClient, "getFullResyncStatus">,
  collectionId: string,
  result: FullResyncResult,
): Promise<FullResyncResult> {
  let current = result;
  let retryCount = 0;
  let nextDelay = POLL_INTERVAL_MS;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (
    current.status !== "completed" &&
    current.status !== "failed" &&
    current.status !== "quota-blocked"
  ) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for full resync ${result.jobId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(nextDelay, deadline - Date.now())));
    try {
      current = await client.getFullResyncStatus(collectionId, result.jobId);
      retryCount = 0;
      nextDelay = POLL_INTERVAL_MS;
    } catch (error) {
      if (!isRetryablePollingError(error)) throw error;
      nextDelay = pollingDelayMs(retryCount++, error);
    }
  }
  return current;
}

function failOperation(operation: ApiSourceOperation): never {
  const rawDetail =
    operation.diagnostics && typeof operation.diagnostics === "object"
      ? (operation.diagnostics as { message?: unknown }).message
      : undefined;
  const detail = typeof rawDetail === "string" ? rawDetail : undefined;
  console.error(
    `Source operation ${operation.id} ${statusName(operation.status).toLowerCase()}.${detail ? ` ${detail}` : ""}`,
  );
  process.exit(1);
}

export async function runCollectionOperation(
  action: CollectionOperationAction,
  collectionRef: string,
  options: Options,
): Promise<void> {
  const client = getApiClient();
  try {
    const collectionId = await resolveCollectionRef(collectionRef, client);
    if (options.dryRun) {
      const details =
        options.refreshSourceFirst === undefined
          ? { collectionId }
          : { collectionId, refreshSourceFirst: options.refreshSourceFirst };
      printDryRun(action.replaceAll("-", " "), details);
      return;
    }

    if (action === "operations") {
      printResult(await client.listCollectionOperations(collectionId), options);
      return;
    }
    if (action === "pause") {
      printResult(await client.pauseCollection(collectionId), options);
      return;
    }
    if (action === "resume") {
      printResult(await client.resumeCollection(collectionId), options);
      return;
    }

    if (action === "full-resync") {
      const result: FullResyncResult = await client.fullResyncCollection(collectionId, {
        refreshSourceFirst: options.refreshSourceFirst,
      });
      const settled = options.wait ? await waitForFullResync(client, collectionId, result) : result;
      printResult(settled, options);
      if (options.wait && settled.status !== "completed") {
        console.error(`Full resync did not complete: ${settled.status}`);
        process.exit(1);
      }
      return;
    }

    const operation =
      action === "sync-now"
        ? await client.syncCollectionNow(collectionId)
        : await client.fullRefreshCollection(collectionId);
    const settled = options.wait ? await waitForOperation(client, operation) : operation;
    printResult(settled, options);
    // Fire-and-forget requests succeed once the operation is accepted. An
    // already terminal failure is still reported immediately; otherwise only
    // an explicitly requested wait evaluates the eventual outcome.
    if (
      settled.status !== OPERATION_STATUS.COMPLETED &&
      (options.wait ||
        settled.status === OPERATION_STATUS.FAILED ||
        settled.status === OPERATION_STATUS.BLOCKED)
    ) {
      failOperation(settled);
    }
  } catch (error) {
    handleCliError(error);
  }
}
