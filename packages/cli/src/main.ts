#!/usr/bin/env node
import { parseCliArgs, resolveOutputFormat } from "./cli-args";
import { bool, fail, str, type CommandContext } from "./command-context";
import { countItems, queryItems } from "./commands/items";
import { login, logout } from "./commands/login";
import { isResource } from "./commands/resources";
import { setup } from "./commands/setup";
import { status } from "./commands/status";
import { runComponentsCommand } from "./dispatch/components";
import { runOrganizationsCommand } from "./dispatch/organizations";
import { runResourceCommand } from "./dispatch/resources";
import { runWorkspacesCommand } from "./dispatch/workspaces";
import { printUsage } from "./usage";

/**
 * `items` forwards its own argv slice rather than the parsed values, because
 * the item commands accept flags that the top-level parser does not declare.
 */
async function runItemsCommand(ctx: CommandContext): Promise<void> {
  const action = ctx.positionals[1];
  const rest = process.argv.slice(process.argv.indexOf("items") + 2);
  if (action === "query" || action === undefined) return queryItems(rest);
  if (action === "count") return countItems(rest);
  fail(`Unknown items action: ${action}. Use query or count`);
}

const commands: Record<string, (ctx: CommandContext) => Promise<void> | void> = {
  login: (ctx) => login({ noBrowser: bool(ctx.values, "no-browser") }),
  logout: (ctx) => logout({ dryRun: ctx.dryRun }),
  status: (ctx) => status(ctx.outputFormat, ctx.full),
  setup: (ctx) =>
    setup({
      package: str(ctx.values, "package"),
      appName: str(ctx.values, "app-name"),
      envFile: str(ctx.values, "env-file"),
      nonInteractive: bool(ctx.values, "non-interactive") ?? false,
      dryRun: ctx.dryRun,
    }),
  items: runItemsCommand,
  workspaces: runWorkspacesCommand,
  orgs: runOrganizationsCommand,
  organizations: runOrganizationsCommand,
  components: runComponentsCommand,
};

async function main() {
  const { values, positionals } = parseCliArgs(process.argv.slice(2));
  const cmd = positionals[0];

  const workspace = str(values, "workspace");
  if (workspace) process.env.CONTFU_WORKSPACE = workspace;

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (!cmd) {
    printUsage();
    process.exit(1);
  }

  const ctx: CommandContext = {
    values,
    positionals,
    outputFormat: resolveOutputFormat(values),
    full: bool(values, "full"),
    dryRun: bool(values, "dry-run") ?? false,
  };

  const command = commands[cmd];
  if (command) return command(ctx);

  if (isResource(cmd)) return runResourceCommand(cmd, ctx);

  console.error(`Unknown command: ${cmd}`);
  printUsage();
  process.exit(1);
}

void main();
