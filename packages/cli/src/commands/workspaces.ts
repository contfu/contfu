import type { ApiWorkspace } from "@contfu/svc-api";
import { getApiClient, getBaseUrl, handleCliError } from "../http";
import { printTable as printRows, terminalLink, type TableColumn } from "../table";
import { readConfig, writeConfig } from "./login";

function workspaceLink(id: string): string {
  const baseUrl = getBaseUrl().replace(/\/+$/, "");
  return terminalLink(id, `${baseUrl}/workspaces/${encodeURIComponent(id)}`);
}

const WORKSPACE_COLUMNS: TableColumn<ApiWorkspace>[] = [
  { header: "ID", value: (workspace) => workspaceLink(workspace.id) },
  { header: "Name", value: (workspace) => workspace.name },
  { header: "Display Name", value: (workspace) => workspace.displayName },
  { header: "Joined", value: (workspace) => (workspace.isJoined ? "yes" : "no") },
  { header: "Manage", value: (workspace) => (workspace.canManage ? "yes" : "no") },
  { header: "Default", value: (workspace) => (workspace.isDefault ? "yes" : "") },
];

function printTable(workspaces: ApiWorkspace[]) {
  printRows(workspaces, WORKSPACE_COLUMNS);
}

async function resolveWorkspace(ref: string): Promise<ApiWorkspace> {
  const client = getApiClient(null);
  const workspaces = await client.listWorkspaces();
  const byId = workspaces.find((workspace) => workspace.id === ref);
  if (byId) return byId;

  const byName = workspaces.filter(
    (workspace) => workspace.name === ref || workspace.displayName === ref,
  );
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new Error("Workspace name is ambiguous; use the workspace id");
  }
  throw new Error(`Workspace not found: ${ref}`);
}

export async function listWorkspaces(format = "table"): Promise<void> {
  try {
    const workspaces = await getApiClient(null).listWorkspaces();
    if (format === "json") console.log(JSON.stringify(workspaces, null, 2));
    else printTable(workspaces);
  } catch (err) {
    handleCliError(err);
  }
}

export async function switchWorkspace(ref: string): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    if (!workspace.isJoined) {
      throw new Error("Workspace is not joined; use `contfu workspaces join <id-or-name>` first");
    }
    const config = await readConfig();
    config.workspaceId = workspace.id;
    await writeConfig(config);
    console.log(`Switched to workspace ${workspace.displayName} (${workspace.id})`);
  } catch (err) {
    handleCliError(err);
  }
}

export async function getWorkspace(ref: string): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    console.log(JSON.stringify(workspace, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function createWorkspace(values: {
  displayName?: string;
  name?: string;
  organizationId?: string;
}): Promise<void> {
  try {
    if (!values.displayName) throw new Error("Missing required flag: --display-name");
    const workspace = await getApiClient(null).createWorkspace({
      displayName: values.displayName,
      name: values.name,
      organizationId: values.organizationId,
    });
    console.log(JSON.stringify(workspace, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function updateWorkspace(
  ref: string,
  values: {
    displayName?: string;
    name?: string;
  },
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    const updated = await getApiClient(null).updateWorkspace(workspace.id, {
      displayName: values.displayName,
      name: values.name,
    });
    console.log(JSON.stringify(updated, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

function parseBudget(value: string | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === "null" || value === "unset" || value === "") return null;
  if (value === "unlimited") return -1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -1) throw new Error(`Invalid budget: ${value}`);
  return parsed;
}

export async function updateWorkspaceBudget(
  ref: string,
  values: Record<string, string | undefined>,
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    const updated = await getApiClient(null).updateWorkspace(workspace.id, {
      maxConnections: parseBudget(values.connections),
      maxCollections: parseBudget(values.collections),
      maxFlows: parseBudget(values.flows),
      maxItems: parseBudget(values.items),
      maxItemChanges: parseBudget(values["item-changes"]),
    });
    console.log(JSON.stringify(updated, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function inviteWorkspace(ref: string, email?: string): Promise<void> {
  try {
    if (!email) throw new Error("Missing required flag: --email");
    const workspace = await resolveWorkspace(ref);
    const invitation = await getApiClient(null).inviteWorkspaceMember(workspace.id, { email });
    console.log(JSON.stringify(invitation, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function acceptWorkspaceInvite(token?: string): Promise<void> {
  try {
    if (!token) throw new Error("Usage: contfu workspaces accept <token>");
    const result = await getApiClient(null).acceptWorkspaceInvitation(token);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function joinWorkspaceCommand(ref: string): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    const result = await getApiClient(null).joinWorkspace(workspace.id);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function listWorkspaceMembers(ref: string): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    const members = await getApiClient(null).listWorkspaceMembers(workspace.id);
    printRows(members, [
      { header: "Email", value: (member) => member.email },
      { header: "Name", value: (member) => member.name },
    ]);
  } catch (err) {
    handleCliError(err);
  }
}

export async function revokeWorkspaceMember(ref: string, email?: string): Promise<void> {
  try {
    if (!email) throw new Error("Usage: contfu workspaces revoke <workspace> <email>");
    const workspace = await resolveWorkspace(ref);
    await getApiClient(null).revokeWorkspaceMember(workspace.id, email);
    console.log("Workspace membership revoked");
  } catch (err) {
    handleCliError(err);
  }
}
