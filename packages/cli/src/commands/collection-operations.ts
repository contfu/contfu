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

function printOperation(operation: ApiSourceOperation): void {
  console.log(`${operationName(operation.operation)}  ${statusName(operation.status)}`);
  console.log(`  id: ${operation.id}  collection: ${operation.collectionId}`);
  if (operation.failureCategory) console.log(`  failure: ${operation.failureCategory}`);
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

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function isRetryablePollingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 429 || error.status >= 500);
}

async function waitForOperation(
  client: Pick<ContfuApiClient, "getSourceOperation">,
  operation: ApiSourceOperation,
): Promise<ApiSourceOperation> {
  let current = operation;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (
    current.status !== OPERATION_STATUS.COMPLETED &&
    current.status !== OPERATION_STATUS.FAILED &&
    current.status !== OPERATION_STATUS.BLOCKED
  ) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for source operation ${operation.id}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      current = await client.getSourceOperation(current.id);
    } catch (error) {
      if (!isRetryablePollingError(error)) throw error;
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
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (
    current.status !== "completed" &&
    current.status !== "failed" &&
    current.status !== "quota-blocked"
  ) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for full resync ${result.jobId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      current = await client.getFullResyncStatus(collectionId, result.jobId);
    } catch (error) {
      if (!isRetryablePollingError(error)) throw error;
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
