import type {
  AddScannedCollectionsResult,
  AddedScannedCollection,
  ScannedCollection,
} from "@contfu/svc-api";
import { getApiClient, handleCliError } from "../http";
import { resolveIntegrationRef } from "./resources";
import { multiSelect } from "./select";
import { printDryRun, type DryRunOption } from "./dry-run";

export interface ScanOptions extends DryRunOption {
  format: string;
  select?: boolean;
}

export interface AddOptions extends DryRunOption {
  format: string;
  refs?: string[];
  all?: boolean;
}

function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

type Column<T> = { header: string; value: (row: T) => string };

function printTable<T>(rows: T[], columns: Column<T>[]) {
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }

  const widths = columns.map((column) =>
    Math.max(column.header.length, ...rows.map((row) => column.value(row).length)),
  );

  console.log(columns.map((column, i) => column.header.padEnd(widths[i])).join("  "));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(columns.map((column, i) => column.value(row).padEnd(widths[i])).join("  "));
  }
}

function printScannedCollections(scanned: ScannedCollection[]) {
  printTable(scanned, [
    { header: "Ref", value: (row) => row.ref },
    { header: "Display Name", value: (row) => row.displayName },
    { header: "Scope", value: (row) => row.scope ?? "" },
    { header: "Status", value: (row) => (row.alreadyAdded ? "already added" : "available") },
  ]);
}

function printAddedRows<T extends AddedScannedCollection | ScannedCollection>(
  title: string,
  rows: T[],
) {
  if (rows.length === 0) return;
  console.log(title);
  printTable(rows, [
    { header: "Ref", value: (row) => row.ref },
    { header: "Display Name", value: (row) => row.displayName },
    { header: "Scope", value: (row) => row.scope ?? "" },
  ]);
}

export function printAddSummary(summary: AddScannedCollectionsResult) {
  console.log(`Scanned ${summary.scanned} collection${summary.scanned === 1 ? "" : "s"}.`);
  console.log(`Added ${summary.added.length} collection${summary.added.length === 1 ? "" : "s"}.`);
  if (summary.alreadyAdded.length > 0) {
    console.log(
      `Skipped ${summary.alreadyAdded.length} collection${summary.alreadyAdded.length === 1 ? "" : "s"} already in Contfu.`,
    );
  }
  if (summary.added.length > 0) {
    console.log();
    printAddedRows("Added:", summary.added);
  }
  if (summary.alreadyAdded.length > 0) {
    console.log();
    printAddedRows("Already added:", summary.alreadyAdded);
  }
}

function parseRefs(refs: string | undefined): string[] | undefined {
  const parsed = refs
    ?.split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
  return parsed && parsed.length > 0 ? parsed : undefined;
}

export async function scanIntegrationCollections(
  integrationId: string,
  options: ScanOptions,
): Promise<void> {
  const client = getApiClient();

  try {
    const resolvedIntegrationId = await resolveIntegrationRef(integrationId, client);
    const scanned = await client.scanCollections(resolvedIntegrationId);

    if (!options.select) {
      if (options.format === "json") printJson(scanned);
      else printScannedCollections(scanned);
      return;
    }

    if (!process.stdin.isTTY) {
      console.error("--select requires an interactive TTY");
      process.exit(1);
    }

    const refs = await multiSelect(
      scanned.map((collection) => ({
        label: collection.displayName,
        description: collection.ref,
        value: collection.ref,
        disabled: collection.alreadyAdded,
      })),
    );

    if (options.dryRun) {
      printDryRun("add selected scanned collections", {
        integrationId: resolvedIntegrationId,
        refs,
      });
      return;
    }

    const summary = await client.addScannedCollections(resolvedIntegrationId, { refs });
    if (options.format === "json") printJson(summary);
    else printAddSummary(summary);
  } catch (err) {
    handleCliError(err);
  }
}

export async function addIntegrationCollections(
  integrationId: string,
  options: AddOptions,
): Promise<void> {
  const client = getApiClient();

  if (!options.all && (!options.refs || options.refs.length === 0)) {
    console.error(
      "Usage: contfu integrations add <integration-id-or-name> (--refs <comma-separated> | --all)",
    );
    process.exit(1);
  }

  try {
    const resolvedIntegrationId = await resolveIntegrationRef(integrationId, client);
    const body = {
      refs: options.all ? undefined : options.refs,
      all: options.all,
    };
    if (options.dryRun) {
      printDryRun("add scanned collections", { integrationId: resolvedIntegrationId, body });
      return;
    }
    const summary = await client.addScannedCollections(resolvedIntegrationId, body);
    if (options.format === "json") printJson(summary);
    else printAddSummary(summary);
  } catch (err) {
    handleCliError(err);
  }
}

export function parseAddRefs(rawRefs: string | undefined): string[] | undefined {
  return parseRefs(rawRefs);
}
