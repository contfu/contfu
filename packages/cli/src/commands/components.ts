import { getApiClient, handleCliError } from "../http";
import { printTable } from "../table";
import { resolveIntegrationRef } from "./resources";
import { printDryRun, type DryRunOption } from "./dry-run";

export async function listIntegrationComponents(integrationRef: string, format = "table") {
  try {
    const client = getApiClient();
    const integrationId = await resolveIntegrationRef(integrationRef, client);
    const components = await client.listIntegrationComponents(integrationId);
    if (format === "json") {
      console.log(JSON.stringify(components, null, 2));
      return;
    }
    printTable(components, [
      { header: "ID", value: (row) => row.id },
      { header: "Name", value: (row) => row.name },
      { header: "Display", value: (row) => row.displayName },
      { header: "Provider Ref", value: (row) => row.providerRef },
      { header: "Status", value: (row) => (row.status === 0 ? "unreviewed" : "reviewed") },
    ]);
  } catch (err) {
    handleCliError(err);
  }
}

export async function inspectComponent(id: string) {
  try {
    const component = await getApiClient().getComponent(id);
    console.log(JSON.stringify(component, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function updateComponentCommand(
  id: string,
  input: { name?: string; displayName?: string; data?: string } & DryRunOption,
) {
  try {
    const body = input.data ? JSON.parse(input.data) : {};
    if (input.name !== undefined) body.name = input.name;
    if (input.displayName !== undefined) body.displayName = input.displayName;
    if (input.dryRun) {
      printDryRun("update component", { id, body });
      return;
    }
    const component = await getApiClient().updateComponent(id, body);
    console.log(JSON.stringify(component, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function createComponentCommand(
  integrationRef: string,
  input: {
    name?: string;
    displayName?: string;
    providerRef?: string;
    data?: string;
  } & DryRunOption,
) {
  try {
    const client = getApiClient();
    const integrationId = await resolveIntegrationRef(integrationRef, client);
    const body = input.data ? JSON.parse(input.data) : {};
    if (input.name !== undefined) body.name = input.name;
    if (input.displayName !== undefined) body.displayName = input.displayName;
    if (input.providerRef !== undefined) body.providerRef = input.providerRef;
    if (!body.name || !body.displayName || !body.providerRef)
      throw new Error("Missing --name, --display-name, or --provider-ref");
    if (input.dryRun) {
      printDryRun("create component", { integrationId, body });
      return;
    }
    console.log(JSON.stringify(await client.createComponent(integrationId, body), null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function deleteComponentCommand(id: string, options: DryRunOption = {}) {
  try {
    if (options.dryRun) {
      printDryRun("delete component", { id });
      return;
    }
    await getApiClient().deleteComponent(id);
  } catch (err) {
    handleCliError(err);
  }
}
