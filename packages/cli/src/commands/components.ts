import { getApiClient, handleCliError } from "../http";
import { isStructuredOutputFormat, printStructured } from "../output";
import { printTable } from "../table";
import { resolveIntegrationRef } from "./resources";
import { printDryRun, type DryRunOption } from "./dry-run";
import { translateEnum } from "./presentation";

const COMPONENT_STATUS = { REVIEWED: 1 };

function presentComponent<T extends { status: number }>(component: T) {
  return { ...component, status: translateEnum(component.status, COMPONENT_STATUS) };
}

function compactComponent<
  T extends {
    id: unknown;
    name: unknown;
    displayName: unknown;
    serviceRef: unknown;
    status: number;
  },
>(component: T) {
  const presented = presentComponent(component);
  return {
    id: presented.id,
    name: presented.name,
    displayName: presented.displayName,
    serviceRef: presented.serviceRef,
    status: presented.status,
  };
}

export async function listIntegrationComponents(
  integrationRef: string,
  format = "default",
  full = false,
) {
  try {
    const client = getApiClient();
    const integrationId = await resolveIntegrationRef(integrationRef, client);
    const components = await client.listIntegrationComponents(integrationId);
    if (isStructuredOutputFormat(format)) {
      printStructured(components.map(presentComponent), format, {
        full,
        compact: components.map(compactComponent),
      });
      return;
    }
    printTable(components, [
      { header: "ID", value: (row) => row.id },
      { header: "Name", value: (row) => row.name },
      { header: "Display", value: (row) => row.displayName },
      { header: "Service Ref", value: (row) => row.serviceRef },
      { header: "Status", value: (row) => translateEnum(row.status, COMPONENT_STATUS) },
    ]);
  } catch (err) {
    handleCliError(err);
  }
}

export async function inspectComponent(id: string, format = "default", full = false) {
  try {
    const component = await getApiClient().getComponent(id);
    if (isStructuredOutputFormat(format)) {
      const presented = presentComponent(component);
      printStructured(presented, format, { full, compact: compactComponent(component) });
    } else console.log(JSON.stringify(component, null, 2));
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
    serviceRef?: string;
    data?: string;
  } & DryRunOption,
) {
  try {
    const client = getApiClient();
    const integrationId = await resolveIntegrationRef(integrationRef, client);
    const body = input.data ? JSON.parse(input.data) : {};
    if (input.name !== undefined) body.name = input.name;
    if (input.displayName !== undefined) body.displayName = input.displayName;
    if (input.serviceRef !== undefined) body.serviceRef = input.serviceRef;
    if (!body.name || !body.displayName || !body.serviceRef)
      throw new Error("Missing --name, --display-name, or --service-ref");
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
