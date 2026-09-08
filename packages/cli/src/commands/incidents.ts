import {
  IncidentResolutionMode,
  type ApiIncident,
  type ApiIncidentResolutionPlan,
  type IncidentResolutionResult,
  type ListIncidentsInput,
  type PlanIncidentResolutionInput,
} from "@contfu/svc-api";
import { getApiClient, handleCliError } from "../http";
import { isStructuredOutputFormat, printStructured, type OutputFormat } from "../output";

export interface ListIncidentOptions {
  collectionId?: string;
  flowId?: string;
  includeResolved?: boolean;
  format: OutputFormat;
  full?: boolean;
}

export function formatIncidentAge(createdAt: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(createdAt).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function printIncidentList(incidents: ApiIncident[], now = Date.now()): void {
  if (incidents.length === 0) {
    console.log("No incidents found.");
    return;
  }

  for (const [index, incident] of incidents.entries()) {
    if (index > 0) console.log();
    console.log(
      `${incident.typeName}  ${incident.sourceCollectionName} → ${incident.targetCollectionName}`,
    );
    console.log(`  id: ${incident.id}  flow: ${incident.flowId}`);
    console.log(`  problem: ${incident.problem}`);
    if (incident.suggestedAction) console.log(`  action: ${incident.suggestedAction}`);
    console.log(
      `  affected: ${incident.affectedCount}  age: ${formatIncidentAge(incident.createdAt, now)}  state: ${incident.resolved ? "resolved" : "unresolved"}`,
    );
    if (incident.resolutionMode === IncidentResolutionMode.Dismissible && !incident.resolved) {
      console.log(`  dismiss: contfu incidents dismiss ${incident.id}`);
    }
  }
}

export async function listIncidentNotifications(options: ListIncidentOptions): Promise<void> {
  const input: ListIncidentsInput = {
    ...(options.collectionId ? { collectionId: options.collectionId } : {}),
    ...(options.flowId ? { flowId: options.flowId } : {}),
    ...(options.includeResolved ? { resolved: "all" as const } : {}),
  };

  try {
    const incidents = await getApiClient().listIncidents(input);
    if (isStructuredOutputFormat(options.format)) {
      printStructured(incidents, options.format, { full: options.full });
    } else {
      printIncidentList(incidents);
    }
  } catch (error) {
    handleCliError(error);
  }
}

function printResolutionPlan(plan: ApiIncidentResolutionPlan): void {
  console.log(`Incident resolution plan ${plan.id}`);
  if (plan.actions.length === 0 && plan.manual.length === 0) {
    console.log("  (empty)");
    return;
  }
  for (const action of plan.actions) {
    console.log(`  action ${action.id}: ${action.description}`);
    console.log(`    incidents: ${action.incidentIds.join(", ")}`);
    console.log(`    operation: ${action.kind}`);
    if (action.operation.collectionId)
      console.log(`    collection: ${action.operation.collectionId}`);
    if (action.operation.failedDeliveryId)
      console.log(`    failed delivery: ${action.operation.failedDeliveryId}`);
    if (action.dependsOn.length > 0) console.log(`    depends on: ${action.dependsOn.join(", ")}`);
    if (action.preconditions.length > 0)
      console.log(`    preconditions: ${action.preconditions.join("; ")}`);
  }
  for (const item of plan.manual) {
    console.log(`  manual ${item.id}: ${item.reason}`);
    console.log(`    incidents: ${item.incidentIds.join(", ")}`);
    console.log(`    follow-up: ${item.description}`);
  }
}

function printResolutionResult(result: IncidentResolutionResult): void {
  for (const item of result.results) {
    console.log(`  ${item.actionId}: ${item.status}${item.message ? ` — ${item.message}` : ""}`);
  }
  for (const item of result.manual) {
    console.log(`  ${item.id}: manual follow-up (${item.reason})`);
  }
}

async function confirmResolution(): Promise<boolean> {
  if (!process.stdin.isTTY) return true;
  process.stdout.write("Execute this exact plan? [y/N] ");
  const readline = await import("node:readline");
  const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => reader.once("line", resolve));
    return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
  } finally {
    reader.close();
  }
}

export interface AutoResolveIncidentOptions {
  collectionId?: string;
  flowId?: string;
  format: OutputFormat;
  full?: boolean;
  yes?: boolean;
}

export async function autoResolveIncidents(
  input: PlanIncidentResolutionInput,
  options: AutoResolveIncidentOptions,
): Promise<void> {
  try {
    const plan = await getApiClient().planIncidentResolution(input);
    if (isStructuredOutputFormat(options.format))
      printStructured(plan, options.format, { full: true });
    else printResolutionPlan(plan);
    if (!options.yes && !(await confirmResolution())) {
      if (!isStructuredOutputFormat(options.format)) console.log("Cancelled.");
      return;
    }
    const result = await getApiClient().executeIncidentResolution(plan);
    if (isStructuredOutputFormat(options.format))
      printStructured(result, options.format, { full: true });
    else printResolutionResult(result);
    if (result.results.some((item) => item.status === "failed")) process.exitCode = 1;
  } catch (error) {
    handleCliError(error);
  }
}

export async function dismissIncidentNotification(
  id: string,
  format: OutputFormat,
  full?: boolean,
): Promise<void> {
  try {
    const result = await getApiClient().dismissIncident(id);
    if (isStructuredOutputFormat(format)) {
      printStructured({ incidentId: id, ...result }, format, { full });
    } else {
      console.log(
        `Dismissed incident ${id}${result.dismissed > 1 ? ` and ${result.dismissed - 1} duplicate notification${result.dismissed === 2 ? "" : "s"}` : ""}.`,
      );
    }
  } catch (error) {
    handleCliError(error);
  }
}
