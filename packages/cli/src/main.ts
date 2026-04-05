#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  isResource,
  list,
  get,
  create,
  update,
  del,
  listConnectionTypes,
  regenerateClientKey,
  type CliValues,
} from "./commands/resources";
import { connectionTypes, collectionTypes } from "./commands/generate-types";
import { queryItems, countItems } from "./commands/items";
import { login, logout } from "./commands/login";
import { status } from "./commands/status";
import { setup } from "./commands/setup";
import { discover } from "./commands/discover";

function printUsage() {
  console.error(`Usage: contfu [--help] <command> [args...]

Commands:
  login [--no-browser]              Authenticate
  logout                            Clear stored credentials
  status                            Show resource summary
  setup                             Set up Contfu in a project
  discover <connection-id>          Discover available source collections
  <resource> list                   List all items
  <resource> get <id>               Get item by ID
  <resource> create [options]       Create item
  <resource> update <id> [options]  Update item
  <resource> delete <id>            Delete item
  connections types                  List valid connection types
  connections types <id>             Print TypeScript types for a connection's collections
  connections regenerate-key <id>    Regenerate API key for a client connection
  collections types <id>             Print TypeScript types for a collection
  items query [options]             Query items from client app
  items count [options]             Count items from client app

Resources: connections, collections, flows

collections options:
      --display-name <name>    Display name (required for create)
  -n, --name <name>            Name
      --connection-id <id>     Associate with a client connection
      --[no-]include-ref       Include ref transmission
  -d, --data <json>            Raw JSON body (alternative to above flags)

setup options:
      --package <name>         Package to install: @contfu/contfu or @contfu/client
      --client-name <name>     Name for the client connection
      --env-file <path>        Write CONTFU_KEY to this .env file
      --non-interactive        Skip all prompts (fail if required info is missing)

connections options:
  -n, --name <name>            Label (required for create)
  -t, --type <provider>        Provider ID (default: notion)
      --token <token>           API token (for manual token-based connections)
      --generate-key           Create a client connection and print its API key
  -d, --data <json>            Raw JSON body (alternative to above flags)

flows options:
      --source-id <id>         Source collection ID (required for create)
      --target-id <id>         Target collection ID (required for create)
      --[no-]include-ref       Include ref transmission
  -d, --data <json>            Raw JSON body (alternative to above flags)

items options:
  -u, --client-url <url>       Base URL of the client HTTP server (required)
      --collection <name>      Filter by collection
      --filter <expr>          Filter expression
      --sort <fields>          Sort fields, comma-separated (query only)
      --limit <n>              Limit results (query only, default 20)
      --offset <n>             Offset results (query only, default 0)
      --include <fields>       Comma-separated includes (query only)
      --fields <fields>        Comma-separated field selection (query only)
      --flat                   Flatten nested props (query only)

list options:
  -f, --format <fmt>           Output format: table (default) | json

Environment:
  CONTFU_API_KEY   API key (overrides stored config)`);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      data: { type: "string", short: "d" },
      "no-browser": { type: "boolean" },
      name: { type: "string", short: "n" },
      type: { type: "string", short: "t" },
      url: { type: "string" },
      "display-name": { type: "string" },
      "source-id": { type: "string" },
      "target-id": { type: "string" },
      "connection-id": { type: "string" },
      "include-ref": { type: "boolean" },
      "no-include-ref": { type: "boolean" },
      token: { type: "string" },
      "generate-key": { type: "boolean" },
      format: { type: "string", short: "f" },
      package: { type: "string" },
      "client-name": { type: "string" },
      "env-file": { type: "string" },
      "non-interactive": { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  const cmd = positionals[0];

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (!cmd) {
    printUsage();
    process.exit(1);
  }

  if (cmd === "login") {
    await login({ noBrowser: values["no-browser"] as boolean | undefined });
    return;
  }

  if (cmd === "logout") {
    await logout();
    return;
  }

  if (cmd === "status") {
    await status((values.format as string | undefined) ?? "table");
    return;
  }

  if (cmd === "setup") {
    await setup({
      package: values.package as string | undefined,
      clientName: values["client-name"] as string | undefined,
      envFile: values["env-file"] as string | undefined,
      nonInteractive: (values["non-interactive"] as boolean | undefined) ?? false,
    });
    return;
  }

  if (cmd === "discover") {
    const id = positionals[1];
    if (!id) {
      console.error("Usage: contfu discover <connection-id>");
      process.exit(1);
    }
    await discover(id);
    return;
  }

  if (cmd === "items") {
    const action = positionals[1];
    const rest = process.argv.slice(process.argv.indexOf("items") + 2);
    switch (action) {
      case "query":
      case undefined:
        await queryItems(rest);
        return;
      case "count":
        await countItems(rest);
        return;
      default:
        console.error(`Unknown items action: ${action}. Use query or count`);
        process.exit(1);
    }
  }

  if (isResource(cmd)) {
    const action = positionals[1];
    const id = positionals[2];

    // Special subcommands per resource
    if (action === "regenerate-key") {
      if (cmd !== "connections") {
        console.error(`'regenerate-key' is only available for connections`);
        process.exit(1);
      }
      if (!id) {
        console.error("Usage: contfu connections regenerate-key <id>");
        process.exit(1);
      }
      await regenerateClientKey(id);
      return;
    }

    if (action === "types") {
      if (cmd === "connections") {
        if (!id) {
          listConnectionTypes();
        } else {
          await connectionTypes(id);
        }
        return;
      }
      if (cmd === "collections") {
        if (!id) {
          console.error("Missing id");
          process.exit(1);
        }
        await collectionTypes(id);
        return;
      }
      console.error(`'types' is not available for ${cmd}`);
      process.exit(1);
    }

    const cliValues: CliValues = {
      name: values.name as string | undefined,
      type: values.type as string | undefined,
      url: values.url as string | undefined,
      "display-name": values["display-name"] as string | undefined,
      "source-id": values["source-id"] as string | undefined,
      "target-id": values["target-id"] as string | undefined,
      "connection-id": values["connection-id"] as string | undefined,
      "include-ref": values["include-ref"] as boolean | undefined,
      "no-include-ref": values["no-include-ref"] as boolean | undefined,
      token: values.token as string | undefined,
      "generate-key": values["generate-key"] as boolean | undefined,
    };

    switch (action) {
      case "list":
      case undefined:
        await list(cmd, (values.format as string | undefined) ?? "table");
        return;
      case "get":
        if (!id) {
          console.error("Missing id");
          process.exit(1);
        }
        await get(cmd, id);
        return;
      case "create":
        await create(cmd, values.data as string | undefined, cliValues);
        return;
      case "update":
      case "set":
        if (!id) {
          console.error("Missing id");
          process.exit(1);
        }
        await update(cmd, id, values.data as string | undefined, cliValues);
        return;
      case "delete":
        if (!id) {
          console.error("Missing id");
          process.exit(1);
        }
        await del(cmd, id);
        return;
      default:
        console.error(`Unknown action: ${action}. Use list, get, create, update, or delete`);
        process.exit(1);
    }
  }

  console.error(`Unknown command: ${cmd}`);
  printUsage();
  process.exit(1);
}

void main();
