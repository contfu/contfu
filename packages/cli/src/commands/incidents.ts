import { IncidentResolutionMode, type ApiIncident, type ListIncidentsInput } from "@contfu/svc-api";
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
