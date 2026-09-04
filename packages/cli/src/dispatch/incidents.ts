import { bool, dispatchAction, requireRef, str, type CommandContext } from "../command-context";
import { dismissIncidentNotification, listIncidentNotifications } from "../commands/incidents";

export async function runIncidentsCommand(ctx: CommandContext): Promise<void> {
  const action = ctx.positionals[1] ?? "list";
  await dispatchAction(
    "incidents",
    {
      list: () =>
        listIncidentNotifications({
          collectionId: str(ctx.values, "collection"),
          flowId: str(ctx.values, "flow"),
          includeResolved: bool(ctx.values, "include-resolved"),
          format: ctx.outputFormat,
          full: ctx.full,
        }),
      dismiss: () =>
        dismissIncidentNotification(
          requireRef(ctx.positionals[2], "Usage: contfu incidents dismiss <incident-id>"),
          ctx.outputFormat,
          ctx.full,
        ),
    },
    action,
    ctx,
  );
}
