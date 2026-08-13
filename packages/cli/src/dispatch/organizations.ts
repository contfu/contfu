import {
  acceptOrganizationInvite,
  createOrganization,
  getOrganization,
  inviteOrganization,
  listOrganizationMembers,
  listOrganizations,
  setOrganizationRole,
  updateOrganization,
} from "../commands/organizations";
import {
  dispatchAction,
  requireRef,
  str,
  type ActionHandler,
  type CommandContext,
} from "../command-context";

const usage = (action: string, extra = "") => `Usage: contfu orgs ${action} <id-or-name>${extra}`;

const setRole =
  (role: "admin" | "member", action: string): ActionHandler =>
  (ctx) =>
    setOrganizationRole(
      requireRef(ctx.positionals[2], usage(action, " <email>")),
      ctx.positionals[3],
      role,
      { dryRun: ctx.dryRun },
    );

const handlers: Record<string, ActionHandler> = {
  list: (ctx) => listOrganizations(ctx.outputFormat, ctx.full),

  get: (ctx) =>
    getOrganization(requireRef(ctx.positionals[2], usage("get")), ctx.outputFormat, ctx.full),

  create: (ctx) =>
    createOrganization({
      displayName: str(ctx.values, "display-name"),
      name: str(ctx.values, "name"),
      dryRun: ctx.dryRun,
    }),

  update: (ctx) =>
    updateOrganization(requireRef(ctx.positionals[2], usage("update")), {
      displayName: str(ctx.values, "display-name"),
      name: str(ctx.values, "name"),
      dryRun: ctx.dryRun,
    }),

  invite: (ctx) =>
    inviteOrganization(requireRef(ctx.positionals[2], usage("invite", " --email <email>")), {
      email: str(ctx.values, "email"),
      role: str(ctx.values, "role"),
      dryRun: ctx.dryRun,
    }),

  accept: (ctx) => acceptOrganizationInvite(ctx.positionals[2], { dryRun: ctx.dryRun }),

  members: (ctx) => listOrganizationMembers(requireRef(ctx.positionals[2], usage("members"))),

  promote: setRole("admin", "promote"),

  demote: setRole("member", "demote"),
};

export function runOrganizationsCommand(ctx: CommandContext): Promise<void> {
  return dispatchAction("orgs", handlers, ctx.positionals[1] ?? "list", ctx);
}
