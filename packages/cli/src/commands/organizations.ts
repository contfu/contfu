import type { ApiOrganization } from "@contfu/svc-api";
import { BASE_URL, getApiClient, handleCliError } from "../http";
import { isStructuredOutputFormat, printStructured } from "../output";
import { printTable, terminalLink, type TableColumn } from "../table";
import { printDryRun, type DryRunOption } from "./dry-run";
import { translateEnum } from "./presentation";

const OrganizationRole = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
} as const;

function organizationLink(id: string): string {
  const baseUrl = BASE_URL.replace(/\/+$/, "");
  return terminalLink(id, `${baseUrl}/organizations/${encodeURIComponent(id)}`);
}

const ROLE_LABEL: Record<number, string> = {
  [OrganizationRole.OWNER]: "owner",
  [OrganizationRole.ADMIN]: "admin",
  [OrganizationRole.MEMBER]: "member",
};

function presentOrganization(organization: ApiOrganization) {
  return {
    ...organization,
    role: translateEnum(organization.role, OrganizationRole),
  };
}

function compactOrganization(organization: ApiOrganization) {
  const presented = presentOrganization(organization);
  return {
    id: presented.id,
    name: presented.name,
    displayName: presented.displayName,
    role: presented.role,
    canManage: presented.canManage,
  };
}

const ORGANIZATION_COLUMNS: TableColumn<ApiOrganization>[] = [
  { header: "ID", value: (organization) => organizationLink(organization.id) },
  { header: "Name", value: (organization) => organization.name },
  { header: "Display Name", value: (organization) => organization.displayName },
  { header: "Role", value: (organization) => ROLE_LABEL[organization.role] ?? organization.role },
];

async function resolveOrganization(ref: string): Promise<ApiOrganization> {
  const organizations = await getApiClient(null).listOrganizations();
  const byId = organizations.find((organization) => organization.id === ref);
  if (byId) return byId;
  const byName = organizations.filter(
    (organization) => organization.name === ref || organization.displayName === ref,
  );
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new Error("Organization name is ambiguous; use the organization id");
  }
  throw new Error(`Organization not found: ${ref}`);
}

function roleFromInput(value?: string): number {
  const normalized = value?.toLowerCase() ?? "member";
  if (normalized === "admin") return OrganizationRole.ADMIN;
  if (normalized === "member") return OrganizationRole.MEMBER;
  throw new Error("Role must be member or admin");
}

export async function listOrganizations(format = "default", full = false): Promise<void> {
  try {
    const organizations = await getApiClient(null).listOrganizations();
    if (isStructuredOutputFormat(format))
      printStructured(organizations.map(presentOrganization), format, {
        full,
        compact: organizations.map(compactOrganization),
      });
    else printTable(organizations, ORGANIZATION_COLUMNS);
  } catch (err) {
    handleCliError(err);
  }
}

export async function getOrganization(
  ref: string,
  format = "default",
  full = false,
): Promise<void> {
  try {
    const organization = await resolveOrganization(ref);
    if (isStructuredOutputFormat(format)) {
      printStructured(presentOrganization(organization), format, {
        full,
        compact: compactOrganization(organization),
      });
    } else console.log(JSON.stringify(organization, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function createOrganization(
  values: {
    displayName?: string;
    name?: string;
  } & DryRunOption,
): Promise<void> {
  try {
    if (!values.displayName) throw new Error("Missing required flag: --display-name");
    const body = {
      displayName: values.displayName,
      name: values.name,
    };
    if (values.dryRun) {
      printDryRun("create organization", body);
      return;
    }
    const organization = await getApiClient(null).createOrganization(body);
    console.log(JSON.stringify(organization, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function updateOrganization(
  ref: string,
  values: { displayName?: string; name?: string } & DryRunOption,
): Promise<void> {
  try {
    const organization = await resolveOrganization(ref);
    const body = {
      displayName: values.displayName,
      name: values.name,
    };
    if (values.dryRun) {
      printDryRun("update organization", { id: organization.id, body });
      return;
    }
    const updated = await getApiClient(null).updateOrganization(organization.id, body);
    console.log(JSON.stringify(updated, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function inviteOrganization(
  ref: string,
  values: { email?: string; role?: string } & DryRunOption,
): Promise<void> {
  try {
    if (!values.email) throw new Error("Missing required flag: --email");
    const organization = await resolveOrganization(ref);
    const body = {
      email: values.email,
      role: roleFromInput(values.role),
    };
    if (values.dryRun) {
      printDryRun("invite organization member", { id: organization.id, body });
      return;
    }
    const invitation = await getApiClient(null).inviteOrganizationMember(organization.id, body);
    console.log(JSON.stringify(invitation, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function acceptOrganizationInvite(
  token?: string,
  options: DryRunOption = {},
): Promise<void> {
  try {
    if (!token) throw new Error("Usage: contfu orgs accept <token>");
    if (options.dryRun) {
      printDryRun("accept organization invitation", { token });
      return;
    }
    const result = await getApiClient(null).acceptOrganizationInvitation(token);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}

export async function listOrganizationMembers(ref: string): Promise<void> {
  try {
    const organization = await resolveOrganization(ref);
    const members = await getApiClient(null).listOrganizationMembers(organization.id);
    printTable(members, [
      { header: "Email", value: (member) => member.email },
      { header: "Name", value: (member) => member.name },
      { header: "Role", value: (member) => ROLE_LABEL[member.role] ?? member.role },
    ]);
  } catch (err) {
    handleCliError(err);
  }
}

export async function setOrganizationRole(
  ref: string,
  email: string | undefined,
  role: "admin" | "member",
  options: DryRunOption = {},
): Promise<void> {
  try {
    if (!email)
      throw new Error(
        `Usage: contfu orgs ${role === "admin" ? "promote" : "demote"} <org> <email>`,
      );
    const organization = await resolveOrganization(ref);
    const roleValue = role === "admin" ? OrganizationRole.ADMIN : OrganizationRole.MEMBER;
    if (options.dryRun) {
      printDryRun("update organization member role", {
        id: organization.id,
        email,
        role: roleValue,
      });
      return;
    }
    const updated = await getApiClient(null).updateOrganizationMemberRole(
      organization.id,
      email,
      roleValue,
    );
    console.log(JSON.stringify(updated, null, 2));
  } catch (err) {
    handleCliError(err);
  }
}
