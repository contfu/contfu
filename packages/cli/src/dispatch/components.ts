import {
  createComponentCommand,
  deleteComponentCommand,
  inspectComponent,
  updateComponentCommand,
} from "../commands/components";
import {
  dispatchAction,
  requireRef,
  str,
  type ActionHandler,
  type CommandContext,
} from "../command-context";

const USAGE =
  "Usage: contfu components create <integration-id-or-name> | get|update|delete <component-id>";

const id = (ctx: CommandContext) => requireRef(ctx.positionals[2], USAGE);

const inspect: ActionHandler = (ctx) => inspectComponent(id(ctx), ctx.outputFormat, ctx.full);

const edit: ActionHandler = (ctx) =>
  updateComponentCommand(id(ctx), {
    name: str(ctx.values, "name"),
    displayName: str(ctx.values, "display-name"),
    data: str(ctx.values, "data"),
    dryRun: ctx.dryRun,
  });

const handlers: Record<string, ActionHandler> = {
  create: (ctx) =>
    createComponentCommand(id(ctx), {
      name: str(ctx.values, "name"),
      displayName: str(ctx.values, "display-name"),
      serviceRef: str(ctx.values, "service-ref"),
      data: str(ctx.values, "data"),
      dryRun: ctx.dryRun,
    }),

  get: inspect,
  inspect,

  delete: (ctx) => deleteComponentCommand(id(ctx), { dryRun: ctx.dryRun }),

  update: edit,
  edit,
};

export function runComponentsCommand(ctx: CommandContext): Promise<void> {
  // Every components action needs an id, so reject a bare `contfu components`
  // with the full usage line rather than an unknown-action error.
  requireRef(ctx.positionals[2], USAGE);
  return dispatchAction("components", handlers, ctx.positionals[1] ?? "get", ctx);
}
