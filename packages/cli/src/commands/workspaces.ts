import type { ApiWorkspace } from "@contfu/svc-api";
import { BASE_URL, getApiClient, handleCliError } from "../http";
import { isStructuredOutputFormat, printStructured } from "../output";
import { printTable as printRows, terminalLink, type TableColumn } from "../table";
import { readConfig, writeConfig } from "./login";
import { printDryRun, type DryRunOption } from "./dry-run";
import { translateEnum } from "./presentation";

function workspaceLink(id: string): string {
  const baseUrl = BASE_URL.replace(/\/+$/, "");
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

const ORGANIZATION_ROLE = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

function presentWorkspace(workspace: ApiWorkspace) {
  return {
    ...workspace,
    ...(workspace.organizationRole !== undefined
      ? { organizationRole: translateEnum(workspace.organizationRole, ORGANIZATION_ROLE) }
      : {}),
  };
}

function compactWorkspace(workspace: ApiWorkspace) {
  const presented = presentWorkspace(workspace);
  return {
    id: presented.id,
    name: presented.name,
    displayName: presented.displayName,
    ...(workspace.organizationRole !== undefined
      ? { organizationRole: presented.organizationRole }
      : {}),
    isJoined: presented.isJoined,
    canManage: presented.canManage,
    isDefault: presented.isDefault,
  };
}

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

export async function listWorkspaces(format = "default", full = false): Promise<void> {
  try {
    const workspaces = await getApiClient(null).listWorkspaces();
    if (isStructuredOutputFormat(format))
      printStructured(workspaces.map(presentWorkspace), format, {
        full,
        compact: workspaces.map(compactWorkspace),
      });
    else printTable(workspaces);
  } catch (err) {
    handleCliError(err);
  }
}

export async function switchWorkspace(ref: string, options: DryRunOption = {}): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    if (!workspace.isJoined) {
      throw new Error("Workspace is not joined; use `contfu workspaces join <id-or-name>` first");
    }
    if (options.dryRun) {
      printDryRun("persist selected workspace", {
        id: workspace.id,
        displayName: workspace.displayName,
      });
      return;
    }
    const config = await readConfig();
    config.workspaceId = workspace.id;
    await writeConfig(config);
    console.log(`Switched to workspace ${workspace.displayName} (${workspace.id})`);
  } catch (err) {
    handleCliError(err);
  }
}

export async function getWorkspace(ref: string, format = "default", full = false): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    if (isStructuredOutputFormat(format)) {
      printStructured(presentWorkspace(workspace), format, {
        full,
        compact: compactWorkspace(workspace),
      });
    } else console.log(JSON.stringify(workspace, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function createWorkspace(
  values: {
    displayName?: string;
    name?: string;
    organizationId?: string;
  } & DryRunOption,
): Promise<void> {
  try {
    if (!values.displayName) throw new Error("Missing required flag: --display-name");
    const body = {
      displayName: values.displayName,
      name: values.name,
      organizationId: values.organizationId,
    };
    if (values.dryRun) {
      printDryRun("create workspace", body);
      return;
    }
    const workspace = await getApiClient(null).createWorkspace(body);
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
  } & DryRunOption,
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    const body = {
      displayName: values.displayName,
      name: values.name,
    };
    if (values.dryRun) {
      printDryRun("update workspace", { id: workspace.id, body });
      return;
    }
    const updated = await getApiClient(null).updateWorkspace(workspace.id, body);
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
  options: DryRunOption = {},
): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    const body = {
      maxIntegrations: parseBudget(values.integrations),
      maxCollections: parseBudget(values.collections),
      maxFlows: parseBudget(values.flows),
      maxItems: parseBudget(values.items),
      maxItemChanges: parseBudget(values["item-changes"]),
    };
    if (options.dryRun) {
      printDryRun("update workspace budget", { id: workspace.id, body });
      return;
    }
    const updated = await getApiClient(null).updateWorkspace(workspace.id, body);
    console.log(JSON.stringify(updated, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function inviteWorkspace(
  ref: string,
  email?: string,
  options: DryRunOption = {},
): Promise<void> {
  try {
    if (!email) throw new Error("Missing required flag: --email");
    const workspace = await resolveWorkspace(ref);
    if (options.dryRun) {
      printDryRun("invite workspace member", { id: workspace.id, email });
      return;
    }
    const invitation = await getApiClient(null).inviteWorkspaceMember(workspace.id, { email });
    console.log(JSON.stringify(invitation, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function acceptWorkspaceInvite(
  token?: string,
  options: DryRunOption = {},
): Promise<void> {
  try {
    if (!token) throw new Error("Usage: contfu workspaces accept <token>");
    if (options.dryRun) {
      printDryRun("accept workspace invitation", { token });
      return;
    }
    const result = await getApiClient(null).acceptWorkspaceInvitation(token);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function joinWorkspaceCommand(ref: string, options: DryRunOption = {}): Promise<void> {
  try {
    const workspace = await resolveWorkspace(ref);
    if (options.dryRun) {
      printDryRun("join workspace", { id: workspace.id });
      return;
    }
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

export async function revokeWorkspaceMember(
  ref: string,
  email?: string,
  options: DryRunOption = {},
): Promise<void> {
  try {
    if (!email) throw new Error("Usage: contfu workspaces revoke <workspace> <email>");
    const workspace = await resolveWorkspace(ref);
    if (options.dryRun) {
      printDryRun("revoke workspace membership", { id: workspace.id, email });
      return;
    }
    await getApiClient(null).revokeWorkspaceMember(workspace.id, email);
    console.log("Workspace membership revoked");
  } catch (err) {
    handleCliError(err);
  }
}
