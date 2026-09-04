import {
  runCollectionOperation,
  type CollectionOperationAction,
} from "../commands/collection-operations";
import {
  addIntegrationCollections,
  parseAddRefs,
  scanIntegrationCollections,
} from "../commands/integration-collections";
import { listIntegrationComponents } from "../commands/components";
import { collectionTypes, integrationTypes } from "../commands/generate-types";
import {
  create,
  del,
  get,
  list,
  listIntegrationTypes,
  regenerateAppKey,
  update,
  type Resource,
} from "../commands/resources";
import { toCliValues } from "../cli-args";
import {
  bool,
  fail,
  requireRef,
  str,
  type ActionHandler,
  type CommandContext,
} from "../command-context";

/** Wrap a handler that cannot run without an id positional. */
const withId =
  (usage: string, run: ActionHandler): ActionHandler =>
  (ctx) => {
    requireRef(ctx.positionals[2], usage);
    return run(ctx);
  };

/**
 * Actions that only exist on `contfu integrations`. On another resource they
 * fall through to the shared unknown-action error.
 */
const integrationActions: Record<string, ActionHandler> = {
  scan: withId("Usage: contfu integrations scan <integration-id-or-name>", (ctx) =>
    scanIntegrationCollections(ctx.positionals[2], {
      format: ctx.outputFormat,
      full: ctx.full,
      select: bool(ctx.values, "select"),
      dryRun: ctx.dryRun,
    }),
  ),

  add: withId(
    "Usage: contfu integrations add <integration-id-or-name> (--refs <comma-separated> | --all | --select)",
    (ctx) =>
      addIntegrationCollections(ctx.positionals[2], {
        format: ctx.outputFormat,
        full: ctx.full,
        refs: parseAddRefs(str(ctx.values, "refs")),
        all: bool(ctx.values, "all"),
        select: bool(ctx.values, "select"),
        dryRun: ctx.dryRun,
      }),
  ),

  components: withId("Usage: contfu integrations components <integration-id-or-name>", (ctx) =>
    listIntegrationComponents(ctx.positionals[2], ctx.outputFormat, ctx.full),
  ),

  "regenerate-key": withId(
    "Usage: contfu integrations regenerate-key <integration-id-or-name>",
    (ctx) =>
      regenerateAppKey(ctx.positionals[2], str(ctx.values, "env-file"), { dryRun: ctx.dryRun }),
  ),
};

/** Actions that only exist on `contfu collections`. */
const collectionActions: Record<string, ActionHandler> = Object.fromEntries(
  (["sync-now", "full-refresh", "full-resync", "pause", "resume", "operations"] as const).map(
    (action: CollectionOperationAction) => [
      action,
      withId(`Usage: contfu collections ${action} <collection-id-or-name>`, (ctx) =>
        runCollectionOperation(action, ctx.positionals[2], {
          format: ctx.outputFormat,
          full: ctx.full,
          dryRun: ctx.dryRun,
          wait: bool(ctx.values, "wait"),
          refreshSourceFirst: bool(ctx.values, "refresh-source-first"),
        }),
      ),
    ],
  ),
);

/** `types` generates client typings and means something different per resource. */
async function generateTypes(resource: Resource, ctx: CommandContext): Promise<void> {
  const id = ctx.positionals[2];
  if (resource === "integrations") {
    if (!id) return listIntegrationTypes();
    return integrationTypes(id);
  }
  if (resource === "collections") {
    return collectionTypes(requireRef(id, "Missing id"));
  }
  fail(`'types' is not available for ${resource}`);
}

/** Handler for a CRUD action, which needs to know which resource it runs on. */
type CrudHandler = (resource: Resource, ctx: CommandContext) => Promise<void> | void;

const crudActions: Record<string, CrudHandler> = {
  list: (resource, ctx) => list(resource, ctx.outputFormat, ctx.full),

  get: (resource, ctx) =>
    get(resource, requireRef(ctx.positionals[2], "Missing id"), ctx.outputFormat, ctx.full),

  create: (resource, ctx) =>
    create(
      resource,
      str(ctx.values, "data"),
      toCliValues(ctx.values),
      str(ctx.values, "env-file"),
      {
        dryRun: ctx.dryRun,
      },
    ),

  update: (resource, ctx) =>
    update(
      resource,
      requireRef(ctx.positionals[2], "Missing id"),
      str(ctx.values, "data"),
      toCliValues(ctx.values),
      { dryRun: ctx.dryRun },
    ),

  delete: (resource, ctx) =>
    del(resource, requireRef(ctx.positionals[2], "Missing id"), { dryRun: ctx.dryRun }),
};

crudActions.set = crudActions.update;

export async function runResourceCommand(resource: Resource, ctx: CommandContext): Promise<void> {
  const action = ctx.positionals[1] ?? "list";

  if (resource === "integrations") {
    const special = integrationActions[action];
    if (special) return special(ctx);
  }
  if (resource === "collections") {
    const special = collectionActions[action];
    if (special) return special(ctx);
  }
  if (action === "regenerate-key") fail("'regenerate-key' is only available for integrations");
  if (action === "types") return generateTypes(resource, ctx);

  const crud = crudActions[action];
  if (!crud) {
    const available =
      resource === "collections"
        ? "list, get, create, update, delete, sync-now, full-refresh, full-resync, pause, resume, or operations"
        : "list, get, create, update, or delete";
    fail(`Unknown action: ${action}. Use ${available}`);
  }
  await crud(resource, ctx);
}
