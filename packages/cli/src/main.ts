#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  addConnectionCollections,
  parseAddRefs,
  scanConnectionCollections,
} from "./commands/connection-collections";
import { collectionTypes, connectionTypes } from "./commands/generate-types";
import {
  createComponentCommand,
  deleteComponentCommand,
  inspectComponent,
  listConnectionComponents,
  updateComponentCommand,
} from "./commands/components";
import { countItems, queryItems } from "./commands/items";
import { login, logout } from "./commands/login";
import {
  acceptOrganizationInvite,
  createOrganization,
  getOrganization,
  inviteOrganization,
  listOrganizationMembers,
  listOrganizations,
  setOrganizationRole,
  updateOrganization,
} from "./commands/organizations";
import {
  create,
  del,
  get,
  isResource,
  list,
  listConnectionTypes,
  regenerateAppKey,
  update,
  type CliValues,
} from "./commands/resources";
import { setup } from "./commands/setup";
import { status } from "./commands/status";
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
} from "./commands/workspaces";

function printUsage() {
  console.error(`Usage: contfu [--help] <command> [args...]

Commands:
  login [--no-browser]              Authenticate
  logout                            Clear stored credentials
  status                            Show resource summary
  setup                             Set up Contfu in a project
  <resource> list [options]         List all items
  <resource> get <id-or-name>       Get item by ID or name
  <resource> create [options]       Create item
  <resource> update <id-or-name> [options]
                                    Update item by ID or name
  <resource> delete <id-or-name>    Delete item by ID or name
  connections scan <id-or-name>     Scan source collections for a connection
  connections add <id-or-name>      Add scanned source collections to Contfu
  connections components <id-or-name>
                                    List discovered components for a connection
  components get <id>               Inspect a component
  components update <id>            Edit component name/display/schema/mapping
  connections types                 List valid connection types
  connections types <id-or-name>    Print TypeScript types for a connection's collections
  connections regenerate-key <id-or-name>
                                    Regenerate API key and write to .env
  collections types <id-or-name>    Print TypeScript types for a collection
  items query [options]             Query items from a Server
  items count [options]             Count items in a Server
  workspaces list                   List workspaces
  workspaces get <id-or-name>       Show workspace details
  workspaces create [options]       Create workspace
  workspaces update <id-or-name>    Update workspace
  workspaces budget <id-or-name>    Update workspace budgets
  workspaces invite <id-or-name>    Invite member by email
  workspaces accept <token>         Accept workspace invitation
  workspaces join <id-or-name>      Join workspace as org admin/owner
  workspaces members <id-or-name>   List workspace members
  workspaces revoke <id-or-name> <email>
                                    Revoke workspace membership
  workspaces switch <id-or-name>    Persist selected workspace
  orgs list                         List organizations
  orgs get <id-or-name>             Show organization details
  orgs create [options]             Create organization
  orgs update <id-or-name>          Update organization
  orgs invite <id-or-name>          Invite member by email
  orgs accept <token>               Accept organization invitation
  orgs members <id-or-name>         List organization members
  orgs promote <id-or-name> <email>
                                    Grant organization admin role
  orgs demote <id-or-name> <email>
                                    Remove organization admin role

Resources: connections, collections, flows

collections options:
      --display-name <name>         Display name (required for create)
  -n, --name <name>                 camelCase name
      --connection-id <id-or-name>  Associate with an app connection
  -d, --data <json>                 Raw JSON body (alternative to above flags)

setup options:
      --package <name>              Package to install: @contfu/contfu or @contfu/client
      --app-name <name>             Name for the app connection
      --env-file <path>             Write CONTFU_KEY to this .env file
      --non-interactive             Skip all prompts (fail if required info is missing)

connections options:
  -n, --name <name>                 Label (required for create)
  -t, --type <provider>             Provider ID (default: notion)
      --token <token>               API token (for manual token-based connections)
      --project-id <id>             Sanity project ID
      --scope <scope>               Provider namespace restriction
      --scopes <scopes>             Comma-separated provider namespace restrictions
      --webhook-secret <secret>     Webhook signing secret
      --generate-key                Create an app connection and write its API key to .env
  -d, --data <json>                 Raw JSON body (alternative to above flags)

flows options:
      --source-id <id-or-name>      Source collection ID or name (required for create)
      --target-id <id-or-name>      Target collection ID or name (required for create)
  -d, --data <json>                 Raw JSON body (alternative to above flags)

items options:
  -u, --client-url <url>            Base URL of the Server HTTP API (required)
      --collection <name>           Filter by collection
      --filter <expr>               Filter expression
      --sort <fields>               Sort fields, comma-separated (query only)
      --limit <n>                   Limit results (query only, default 20)
      --offset <n>                  Offset results (query only, default 0)
      --include <fields>            Comma-separated includes (query only)
      --fields <fields>             Comma-separated field selection (query only)
      --flat                        Flatten nested props (query only)

resource options:
  -w, --workspace <id-or-name>      Scope connections, collections, or flows to a workspace

list options:
  -f, --format <fmt>                Output format: table (default) | json

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
      content: { type: "boolean" },
      "no-content": { type: "boolean" },
      token: { type: "string" },
      "project-id": { type: "string" },
      scope: { type: "string" },
      scopes: { type: "string" },
      "webhook-secret": { type: "string" },
      "provider-ref": { type: "string" },
      "generate-key": { type: "boolean" },
      format: { type: "string", short: "f" },
      package: { type: "string" },
      "app-name": { type: "string" },
      "env-file": { type: "string" },
      "non-interactive": { type: "boolean" },
      refs: { type: "string" },
      all: { type: "boolean" },
      select: { type: "boolean", short: "s" },
      workspace: { type: "string", short: "w" },
      organization: { type: "string", short: "o" },
      email: { type: "string" },
      role: { type: "string" },
      connections: { type: "string" },
      collections: { type: "string" },
      flows: { type: "string" },
      items: { type: "string" },
      "item-changes": { type: "string" },
    },
    allowPositionals: true,
    strict: false,
  });

  const cmd = positionals[0];

  if (values.workspace) {
    process.env.CONTFU_WORKSPACE = values.workspace as string;
  }

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
      appName: values["app-name"] as string | undefined,
      envFile: values["env-file"] as string | undefined,
      nonInteractive: (values["non-interactive"] as boolean | undefined) ?? false,
    });
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

  if (cmd === "workspaces") {
    const action = positionals[1] ?? "list";
    const ref = positionals[2];
    if (action === "list") {
      await listWorkspaces((values.format as string | undefined) ?? "table");
      return;
    }
    if (action === "get") {
      if (!ref) {
        console.error("Usage: contfu workspaces get <id-or-name>");
        process.exit(1);
      }
      await getWorkspace(ref);
      return;
    }
    if (action === "create") {
      await createWorkspace({
        displayName: values["display-name"] as string | undefined,
        name: values.name as string | undefined,
        organizationId: values.organization as string | undefined,
      });
      return;
    }
    if (action === "update") {
      if (!ref) {
        console.error("Usage: contfu workspaces update <id-or-name>");
        process.exit(1);
      }
      await updateWorkspace(ref, {
        displayName: values["display-name"] as string | undefined,
        name: values.name as string | undefined,
      });
      return;
    }
    if (action === "budget") {
      if (!ref) {
        console.error("Usage: contfu workspaces budget <id-or-name>");
        process.exit(1);
      }
      await updateWorkspaceBudget(ref, values as Record<string, string | undefined>);
      return;
    }
    if (action === "invite") {
      if (!ref) {
        console.error("Usage: contfu workspaces invite <id-or-name> --email <email>");
        process.exit(1);
      }
      await inviteWorkspace(ref, values.email as string | undefined);
      return;
    }
    if (action === "accept") {
      await acceptWorkspaceInvite(ref);
      return;
    }
    if (action === "join") {
      if (!ref) {
        console.error("Usage: contfu workspaces join <id-or-name>");
        process.exit(1);
      }
      await joinWorkspaceCommand(ref);
      return;
    }
    if (action === "members") {
      if (!ref) {
        console.error("Usage: contfu workspaces members <id-or-name>");
        process.exit(1);
      }
      await listWorkspaceMembers(ref);
      return;
    }
    if (action === "revoke") {
      if (!ref) {
        console.error("Usage: contfu workspaces revoke <id-or-name> <email>");
        process.exit(1);
      }
      await revokeWorkspaceMember(ref, positionals[3]);
      return;
    }
    if (action === "switch") {
      if (!ref) {
        console.error("Usage: contfu workspaces switch <id-or-name>");
        process.exit(1);
      }
      await switchWorkspace(ref);
      return;
    }
    console.error(`Unknown workspaces action: ${action}`);
    process.exit(1);
  }

  if (cmd === "orgs" || cmd === "organizations") {
    const action = positionals[1] ?? "list";
    const ref = positionals[2];
    if (action === "list") {
      await listOrganizations((values.format as string | undefined) ?? "table");
      return;
    }
    if (action === "get") {
      if (!ref) {
        console.error("Usage: contfu orgs get <id-or-name>");
        process.exit(1);
      }
      await getOrganization(ref);
      return;
    }
    if (action === "create") {
      await createOrganization({
        displayName: values["display-name"] as string | undefined,
        name: values.name as string | undefined,
      });
      return;
    }
    if (action === "update") {
      if (!ref) {
        console.error("Usage: contfu orgs update <id-or-name>");
        process.exit(1);
      }
      await updateOrganization(ref, {
        displayName: values["display-name"] as string | undefined,
        name: values.name as string | undefined,
      });
      return;
    }
    if (action === "invite") {
      if (!ref) {
        console.error("Usage: contfu orgs invite <id-or-name> --email <email>");
        process.exit(1);
      }
      await inviteOrganization(ref, {
        email: values.email as string | undefined,
        role: values.role as string | undefined,
      });
      return;
    }
    if (action === "accept") {
      await acceptOrganizationInvite(ref);
      return;
    }
    if (action === "members") {
      if (!ref) {
        console.error("Usage: contfu orgs members <id-or-name>");
        process.exit(1);
      }
      await listOrganizationMembers(ref);
      return;
    }
    if (action === "promote" || action === "demote") {
      if (!ref) {
        console.error(`Usage: contfu orgs ${action} <id-or-name> <email>`);
        process.exit(1);
      }
      await setOrganizationRole(ref, positionals[3], action === "promote" ? "admin" : "member");
      return;
    }
    console.error(`Unknown orgs action: ${action}`);
    process.exit(1);
  }

  if (cmd === "components") {
    const action = positionals[1] ?? "get";
    const id = positionals[2];
    if (!id) {
      console.error("Usage: contfu components get|update <component-id>");
      process.exit(1);
    }
    if (action === "create") {
      await createComponentCommand(id, {
        name: values.name as string | undefined,
        displayName: values["display-name"] as string | undefined,
        providerRef: values["provider-ref"] as string | undefined,
        data: values.data as string | undefined,
      });
      return;
    }
    if (action === "get" || action === "inspect") {
      await inspectComponent(id);
      return;
    }
    if (action === "delete") {
      await deleteComponentCommand(id);
      return;
    }
    if (action === "update" || action === "edit") {
      await updateComponentCommand(id, {
        name: values.name as string | undefined,
        displayName: values["display-name"] as string | undefined,
        data: values.data as string | undefined,
      });
      return;
    }
    console.error(`Unknown components action: ${action}`);
    process.exit(1);
  }

  if (isResource(cmd)) {
    const action = positionals[1];
    const id = positionals[2];

    // Special subcommands per resource
    if (cmd === "connections" && action === "scan") {
      if (!id) {
        console.error("Usage: contfu connections scan <connection-id-or-name>");
        process.exit(1);
      }
      await scanConnectionCollections(id, {
        format: (values.format as string | undefined) ?? "table",
        select: values.select as boolean | undefined,
      });
      return;
    }

    if (cmd === "connections" && action === "add") {
      if (!id) {
        console.error(
          "Usage: contfu connections add <connection-id-or-name> (--refs <comma-separated> | --all)",
        );
        process.exit(1);
      }
      await addConnectionCollections(id, {
        format: (values.format as string | undefined) ?? "table",
        refs: parseAddRefs(values.refs as string | undefined),
        all: values.all as boolean | undefined,
      });
      return;
    }

    if (cmd === "connections" && action === "components") {
      if (!id) {
        console.error("Usage: contfu connections components <connection-id-or-name>");
        process.exit(1);
      }
      await listConnectionComponents(id, (values.format as string | undefined) ?? "table");
      return;
    }

    if (action === "regenerate-key") {
      if (cmd !== "connections") {
        console.error(`'regenerate-key' is only available for connections`);
        process.exit(1);
      }
      if (!id) {
        console.error("Usage: contfu connections regenerate-key <connection-id-or-name>");
        process.exit(1);
      }
      await regenerateAppKey(id, values["env-file"] as string | undefined);
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
      content: values.content as boolean | undefined,
      "no-content": values["no-content"] as boolean | undefined,
      token: values.token as string | undefined,
      "project-id": values["project-id"] as string | undefined,
      scope: values.scope as string | undefined,
      scopes: values.scopes as string | undefined,
      "webhook-secret": values["webhook-secret"] as string | undefined,
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
        await create(
          cmd,
          values.data as string | undefined,
          cliValues,
          values["env-file"] as string | undefined,
        );
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
