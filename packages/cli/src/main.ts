#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  addIntegrationCollections,
  parseAddRefs,
  scanIntegrationCollections,
} from "./commands/integration-collections";
import { collectionTypes, integrationTypes } from "./commands/generate-types";
import {
  createComponentCommand,
  deleteComponentCommand,
  inspectComponent,
  listIntegrationComponents,
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
  listIntegrationTypes,
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
  setup [--dry-run]                 Set up Contfu in a project
  <resource> list [options]         List all items
  <resource> get <id-or-name>       Get item by ID or name
  <resource> create [--dry-run] [options]
                                    Create item
  <resource> update <id-or-name> [--dry-run] [options]
                                    Update item by ID or name
  <resource> delete <id-or-name> [--dry-run]
                                    Delete item by ID or name
  integrations scan <id-or-name>     Scan source collections for an integration
  integrations add <id-or-name> [--refs <refs> | --all | --select] [--dry-run]
                                    Add scanned source collections to Contfu
  integrations components <id-or-name>
                                    List discovered components for an integration
  components create <integration-id-or-name> [--dry-run]
                                    Create a component for an integration
  components get <id>               Inspect a component
  components update <id> [--dry-run]
                                    Edit component name/display/schema/mapping
  components delete <id> [--dry-run]
                                    Delete a component
  integrations types                 List valid integration types
  integrations types <id-or-name>    Print TypeScript types for an integration's collections
  integrations regenerate-key <id-or-name> [--dry-run]
                                    Regenerate API key and write to .env
  collections types <id-or-name>    Print TypeScript types for a collection
  items query [options]             Query items from a Server
  items count [options]             Count items in a Server
  workspaces list                   List workspaces
  workspaces get <id-or-name>       Show workspace details
  workspaces create [--dry-run] [options]
                                    Create workspace
  workspaces update <id-or-name>    Update workspace
  workspaces budget <id-or-name>    Update workspace budgets
  workspaces invite <id-or-name>    Invite member by email
  workspaces accept <token>         Accept workspace invitation
  workspaces join <id-or-name>      Join workspace as org admin/owner
  workspaces members <id-or-name>   List workspace members
  workspaces revoke <id-or-name> <email>
                                    Revoke workspace membership
  workspaces switch <id-or-name> [--dry-run]
                                    Persist selected workspace
  orgs list                         List organizations
  orgs get <id-or-name>             Show organization details
  orgs create [--dry-run] [options]
                                    Create organization
  orgs update <id-or-name>          Update organization
  orgs invite <id-or-name>          Invite member by email
  orgs accept <token> [--dry-run]   Accept organization invitation
  orgs members <id-or-name>         List organization members
  orgs promote <id-or-name> <email> [--dry-run]
                                    Grant organization admin role
  orgs demote <id-or-name> <email> [--dry-run]
                                    Remove organization admin role

Resources: integrations, collections, flows

collections options:
      --display-name <name>         Display name (required for create)
  -n, --name <name>                 camelCase name
      --integration-id <id-or-name>  Associate with an app integration
      --content                     Include rich content blocks in synced items
      --no-content                  Exclude rich content blocks from synced items
      --i18n-locale-field <field>   i18n Locale property used for source locale extraction
      --i18n-locale-map <map>       Locale map entries raw=locale, comma-separated
      --i18n-keep-raw-field         Keep raw locale field in emitted items
      --i18n-drop-raw-field         Drop raw locale field from emitted items
      --i18n-grouping-key <field>   Fallback Grouping Key for grouping translated variants
      --reset-i18n                  Reset the collection user i18n layer; keeps detected i18n
  -d, --data <json>                 Raw JSON body (alternative to above flags)

setup options:
      --package <name>              Package to install: @contfu/contfu or @contfu/client
      --app-name <name>             Name for the app integration
      --env-file <path>             Write CONTFU_KEY to this .env file
      --non-interactive             Skip all prompts (fail if required info is missing)
      --dry-run                     Preview planned changes without mutating state

component options:
  -n, --name <name>                 Component runtime name / block discriminator
      --display-name <name>         Human-readable component name
      --provider-ref <ref>          Provider component identifier (required for create)
  -d, --data <json>                 Raw JSON body for schema/mapping/status updates

integrations options:
  -n, --name <name>                 Label (required for create)
  -t, --type <provider>             Provider ID from integrations types (default: notion)
      --token <token>               API token (for manual token-based integrations)
      --username <name>             WordPress username for application-password auth
      --application-password <pass> WordPress application password
      --contentful-api-mode <mode>  Contentful API mode: delivery or preview
      --contentful-delivery-token <token> Contentful Delivery API token
      --contentful-preview-token <token>  Contentful Preview API token
      --contentful-management-token <token> Contentful Management API token
      --url <url-or-id>             Provider base URL or provider-specific space/site ID
      --project-id <id>             Sanity project ID
      --scope <scope>               Provider namespace restriction
      --scopes <scopes>             Comma-separated provider namespace restrictions
      --webhook-secret <secret>     Webhook signing secret
      --webhook-header <pairs>      Webhook target static headers as Name=Value pairs
      --webhook-max-attempts <n>    Webhook target retry cap
      --webhook-delivery-window <n> Webhook target failed-delivery window
      --include-drafts              Include non-published content where the provider supports it
      --no-include-drafts           Sync published content only where draft mode is supported
      --generate-key                Create an app integration and write its API key to .env
      --i18n-locales <locales>      i18n Locales, comma-separated BCP 47 tags
      --i18n-active-locales <mode>  Active locales: inherit or custom:<locales>
      --i18n-locale-map <map>       Locale map entries raw=locale, comma-separated
      --reset-i18n                  Reset the user i18n layer; keeps detected i18n
      --refs <refs>                 Comma-separated scanned source collection refs to add
      --all                         Add all available scanned source collections
  -s, --select                      Interactively choose scanned source collections to add
  -d, --data <json>                 Raw JSON body (alternative to above flags)

flows options:
      --source-id <id-or-name>      Source collection ID or name (required for create)
      --target-id <id-or-name>      Target collection ID or name (required for create)
  -d, --data <json>                 Raw JSON body for mappings/filters; may be combined with flags

workspace options:
      --display-name <name>         Workspace display name for create/update
  -n, --name <name>                 Workspace slug for create/update
  -o, --organization <id-or-name>   Organization for workspace creation
      --email <email>               Invitee email for workspace invite
      --integrations <n>            Max integrations budget; use unlimited or unset/null
      --collections <n>             Max collections budget; use unlimited or unset/null
      --flows <n>                   Max flows budget; use unlimited or unset/null
      --items <n>                   Max items budget; use unlimited or unset/null
      --item-changes <n>            Max item changes budget; use unlimited or unset/null

organization options:
      --display-name <name>         Organization display name for create/update
  -n, --name <name>                 Organization slug for create/update
      --email <email>               Invitee/member email for invites and role changes
      --role <member|admin>         Role for organization invitations (default: member)

items options:
  -u, --client-url <url>            Base URL of the Server HTTP API (required)
      --collection <name>           Filter by collection
      --filter <expr>               Filter expression
      --search <text>               Convenience title search
      --sort <fields>               Sort fields, comma-separated (query only)
      --limit <n>                   Limit results (query only, default 20)
      --offset <n>                  Offset results (query only, default 0)
      --include <fields>            Comma-separated includes (query only)
      --fields <fields>             Comma-separated field selection (query only)
      --locale <locale|false>       Locale override for localized collections
      --fallback <locale|true|false>
                                    Fallback locale override
      --flat                        Flatten nested props (query only)

resource options:
  -w, --workspace <id-or-name>      Scope integrations, collections, or flows to a workspace

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
      "integration-id": { type: "string" },
      content: { type: "boolean" },
      "no-content": { type: "boolean" },
      token: { type: "string" },
      username: { type: "string" },
      "application-password": { type: "string" },
      "contentful-api-mode": { type: "string" },
      "contentful-delivery-token": { type: "string" },
      "contentful-preview-token": { type: "string" },
      "contentful-management-token": { type: "string" },
      "project-id": { type: "string" },
      scope: { type: "string" },
      scopes: { type: "string" },
      "webhook-secret": { type: "string" },
      "webhook-header": { type: "string" },
      "webhook-max-attempts": { type: "string" },
      "webhook-delivery-window": { type: "string" },
      "provider-ref": { type: "string" },
      locale: { type: "string" },
      fallback: { type: "string" },
      "generate-key": { type: "boolean" },
      "i18n-locales": { type: "string" },
      "i18n-active-locales": { type: "string" },
      "i18n-locale-map": { type: "string" },
      "i18n-locale-field": { type: "string" },
      "i18n-keep-raw-field": { type: "boolean" },
      "i18n-drop-raw-field": { type: "boolean" },
      "i18n-grouping-key": { type: "string" },
      "reset-i18n": { type: "boolean" },
      "include-drafts": { type: "boolean" },
      "no-include-drafts": { type: "boolean" },
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
      integrations: { type: "string" },
      collections: { type: "string" },
      flows: { type: "string" },
      items: { type: "string" },
      "item-changes": { type: "string" },
      "dry-run": { type: "boolean" },
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

  const dryRun = (values["dry-run"] as boolean | undefined) ?? false;

  if (cmd === "logout") {
    await logout({ dryRun });
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
      dryRun,
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
        dryRun,
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
        dryRun,
      });
      return;
    }
    if (action === "budget") {
      if (!ref) {
        console.error("Usage: contfu workspaces budget <id-or-name>");
        process.exit(1);
      }
      await updateWorkspaceBudget(ref, values as Record<string, string | undefined>, { dryRun });
      return;
    }
    if (action === "invite") {
      if (!ref) {
        console.error("Usage: contfu workspaces invite <id-or-name> --email <email>");
        process.exit(1);
      }
      await inviteWorkspace(ref, values.email as string | undefined, { dryRun });
      return;
    }
    if (action === "accept") {
      await acceptWorkspaceInvite(ref, { dryRun });
      return;
    }
    if (action === "join") {
      if (!ref) {
        console.error("Usage: contfu workspaces join <id-or-name>");
        process.exit(1);
      }
      await joinWorkspaceCommand(ref, { dryRun });
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
      await revokeWorkspaceMember(ref, positionals[3], { dryRun });
      return;
    }
    if (action === "switch") {
      if (!ref) {
        console.error("Usage: contfu workspaces switch <id-or-name>");
        process.exit(1);
      }
      await switchWorkspace(ref, { dryRun });
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
        dryRun,
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
        dryRun,
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
        dryRun,
      });
      return;
    }
    if (action === "accept") {
      await acceptOrganizationInvite(ref, { dryRun });
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
      await setOrganizationRole(ref, positionals[3], action === "promote" ? "admin" : "member", {
        dryRun,
      });
      return;
    }
    console.error(`Unknown orgs action: ${action}`);
    process.exit(1);
  }

  if (cmd === "components") {
    const action = positionals[1] ?? "get";
    const id = positionals[2];
    if (!id) {
      console.error(
        "Usage: contfu components create <integration-id-or-name> | get|update|delete <component-id>",
      );
      process.exit(1);
    }
    if (action === "create") {
      await createComponentCommand(id, {
        name: values.name as string | undefined,
        displayName: values["display-name"] as string | undefined,
        providerRef: values["provider-ref"] as string | undefined,
        data: values.data as string | undefined,
        dryRun,
      });
      return;
    }
    if (action === "get" || action === "inspect") {
      await inspectComponent(id);
      return;
    }
    if (action === "delete") {
      await deleteComponentCommand(id, { dryRun });
      return;
    }
    if (action === "update" || action === "edit") {
      await updateComponentCommand(id, {
        name: values.name as string | undefined,
        displayName: values["display-name"] as string | undefined,
        data: values.data as string | undefined,
        dryRun,
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
    if (cmd === "integrations" && action === "scan") {
      if (!id) {
        console.error("Usage: contfu integrations scan <integration-id-or-name>");
        process.exit(1);
      }
      await scanIntegrationCollections(id, {
        format: (values.format as string | undefined) ?? "table",
        select: values.select as boolean | undefined,
        dryRun,
      });
      return;
    }

    if (cmd === "integrations" && action === "add") {
      if (!id) {
        console.error(
          "Usage: contfu integrations add <integration-id-or-name> (--refs <comma-separated> | --all | --select)",
        );
        process.exit(1);
      }
      await addIntegrationCollections(id, {
        format: (values.format as string | undefined) ?? "table",
        refs: parseAddRefs(values.refs as string | undefined),
        all: values.all as boolean | undefined,
        select: values.select as boolean | undefined,
        dryRun,
      });
      return;
    }

    if (cmd === "integrations" && action === "components") {
      if (!id) {
        console.error("Usage: contfu integrations components <integration-id-or-name>");
        process.exit(1);
      }
      await listIntegrationComponents(id, (values.format as string | undefined) ?? "table");
      return;
    }

    if (action === "regenerate-key") {
      if (cmd !== "integrations") {
        console.error(`'regenerate-key' is only available for integrations`);
        process.exit(1);
      }
      if (!id) {
        console.error("Usage: contfu integrations regenerate-key <integration-id-or-name>");
        process.exit(1);
      }
      await regenerateAppKey(id, values["env-file"] as string | undefined, { dryRun });
      return;
    }

    if (action === "types") {
      if (cmd === "integrations") {
        if (!id) {
          listIntegrationTypes();
        } else {
          await integrationTypes(id);
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
      "integration-id": values["integration-id"] as string | undefined,
      content: values.content as boolean | undefined,
      "no-content": values["no-content"] as boolean | undefined,
      token: values.token as string | undefined,
      username: values.username as string | undefined,
      "application-password": values["application-password"] as string | undefined,
      "contentful-api-mode": values["contentful-api-mode"] as string | undefined,
      "contentful-delivery-token": values["contentful-delivery-token"] as string | undefined,
      "contentful-preview-token": values["contentful-preview-token"] as string | undefined,
      "contentful-management-token": values["contentful-management-token"] as string | undefined,
      "project-id": values["project-id"] as string | undefined,
      scope: values.scope as string | undefined,
      scopes: values.scopes as string | undefined,
      "webhook-secret": values["webhook-secret"] as string | undefined,
      "webhook-header": values["webhook-header"] as string | undefined,
      "webhook-max-attempts": values["webhook-max-attempts"] as string | undefined,
      "webhook-delivery-window": values["webhook-delivery-window"] as string | undefined,
      "generate-key": values["generate-key"] as boolean | undefined,
      "i18n-locales": values["i18n-locales"] as string | undefined,
      "i18n-active-locales": values["i18n-active-locales"] as string | undefined,
      "i18n-locale-map": values["i18n-locale-map"] as string | undefined,
      "i18n-locale-field": values["i18n-locale-field"] as string | undefined,
      "i18n-keep-raw-field": values["i18n-keep-raw-field"] as boolean | undefined,
      "i18n-drop-raw-field": values["i18n-drop-raw-field"] as boolean | undefined,
      "i18n-grouping-key": values["i18n-grouping-key"] as string | undefined,
      "reset-i18n": values["reset-i18n"] as boolean | undefined,
      "include-drafts": values["include-drafts"] as boolean | undefined,
      "no-include-drafts": values["no-include-drafts"] as boolean | undefined,
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
          { dryRun },
        );
        return;
      case "update":
      case "set":
        if (!id) {
          console.error("Missing id");
          process.exit(1);
        }
        await update(cmd, id, values.data as string | undefined, cliValues, { dryRun });
        return;
      case "delete":
        if (!id) {
          console.error("Missing id");
          process.exit(1);
        }
        await del(cmd, id, { dryRun });
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
