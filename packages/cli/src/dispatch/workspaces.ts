import {
  acceptWorkspaceInvite,
  createWorkspace,
  getWorkspace,
  inviteWorkspace,
  joinWorkspaceCommand,
  listWorkspaceMembers,
  listWorkspaces,
  revokeWorkspaceMember,
  switchWorkspace,
  updateWorkspace,
  updateWorkspaceBudget,
} from "../commands/workspaces";
import {
  dispatchAction,
  requireRef,
  str,
  type ActionHandler,
  type CommandContext,
} from "../command-context";

const usage = (action: string, extra = "") =>
  `Usage: contfu workspaces ${action} <id-or-name>${extra}`;

const handlers: Record<string, ActionHandler> = {
  list: (ctx) => listWorkspaces(ctx.outputFormat, ctx.full),

  get: (ctx) =>
    getWorkspace(requireRef(ctx.positionals[2], usage("get")), ctx.outputFormat, ctx.full),

  create: (ctx) =>
    createWorkspace({
      displayName: str(ctx.values, "display-name"),
      name: str(ctx.values, "name"),
      organizationId: str(ctx.values, "organization"),
      dryRun: ctx.dryRun,
    }),

  update: (ctx) =>
    updateWorkspace(requireRef(ctx.positionals[2], usage("update")), {
      displayName: str(ctx.values, "display-name"),
      name: str(ctx.values, "name"),
      dryRun: ctx.dryRun,
    }),

  budget: (ctx) =>
    updateWorkspaceBudget(
      requireRef(ctx.positionals[2], usage("budget")),
      ctx.values as Record<string, string | undefined>,
      { dryRun: ctx.dryRun },
    ),

  invite: (ctx) =>
    inviteWorkspace(
      requireRef(ctx.positionals[2], usage("invite", " --email <email>")),
      str(ctx.values, "email"),
      { dryRun: ctx.dryRun },
    ),

  accept: (ctx) => acceptWorkspaceInvite(ctx.positionals[2], { dryRun: ctx.dryRun }),

  join: (ctx) =>
    joinWorkspaceCommand(requireRef(ctx.positionals[2], usage("join")), { dryRun: ctx.dryRun }),

  members: (ctx) => listWorkspaceMembers(requireRef(ctx.positionals[2], usage("members"))),

  revoke: (ctx) =>
    revokeWorkspaceMember(
      requireRef(ctx.positionals[2], usage("revoke", " <email>")),
      ctx.positionals[3],
      { dryRun: ctx.dryRun },
    ),

  switch: (ctx) =>
    switchWorkspace(requireRef(ctx.positionals[2], usage("switch")), { dryRun: ctx.dryRun }),
};

export function runWorkspacesCommand(ctx: CommandContext): Promise<void> {
  return dispatchAction("workspaces", handlers, ctx.positionals[1] ?? "list", ctx);
}
