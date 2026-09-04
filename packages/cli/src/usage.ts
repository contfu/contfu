export function printUsage() {
  console.error(`Usage: contfu [--help] <command> [args...]

Commands:
  login [--no-browser]              Authenticate
  logout                            Clear stored credentials
  status [--format default|agent|json] [--full]
                                    Show resource summary
  setup [--dry-run]                 Set up Contfu in a project
  <resource> list [options]         List all items
  <resource> get <id-or-name> [--format default|agent|json] [--full]
                                    Get item by ID or name
  <resource> create [--dry-run] [options]
                                    Create item
  <resource> update <id-or-name> [--dry-run] [options]
                                    Update item by ID or name
  <resource> delete <id-or-name> [--dry-run]
                                    Delete item by ID or name
  integrations scan <id-or-name> [--format default|agent|json] [--full]
                                    Scan source collections for an integration
  integrations add <id-or-name> [--refs <refs> | --all | --select]
  [--format default|agent|json] [--full] [--dry-run]
                                    Add scanned source collections to Contfu
  integrations components <id-or-name> [--format default|agent|json] [--full]
                                    List discovered components for an integration
  components create <integration-id-or-name> [--dry-run]
                                    Create a component for an integration
  components get <id> [--format default|agent|json] [--full]
                                    Inspect a component
  components update <id> [--dry-run]
                                    Edit component name/display/schema/mapping
  components delete <id> [--dry-run]
                                    Delete a component
  incidents list [--collection <id>] [--flow <id>] [--include-resolved]
                                    List unresolved incidents
  incidents dismiss <incident-id>
                                    Dismiss a dismissible incident condition
  integrations types                 List valid integration types
  integrations types <id-or-name>    Print TypeScript types for an integration's collections
  integrations regenerate-key <id-or-name> [--dry-run]
                                    Regenerate API key and write to .env
  collections types <id-or-name>    Print TypeScript types for a collection
  collections sync-now <id-or-name> [--wait] [--dry-run]
                                    Trigger Sync now for a source collection
  collections full-refresh <id-or-name> [--wait] [--dry-run]
                                    Trigger Full refresh for a source collection
  collections full-resync <id-or-name> [--refresh-source-first] [--wait] [--dry-run]
                                    Trigger target Full resync
  collections pause <id-or-name> [--dry-run]
                                    Pause source synchronization
  collections resume <id-or-name> [--dry-run]
                                    Resume source synchronization
  collections operations <id-or-name> [-f json]
                                    Show source operation history
  items query [options]             Query items from a Server
  items count [options]             Count items in a Server
  workspaces list [--format default|agent|json] [--full]
                                    List workspaces
  workspaces get <id-or-name> [--format default|agent|json] [--full]
                                    Show workspace details
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
  orgs list [--format default|agent|json] [--full]
                                    List organizations
  orgs get <id-or-name> [--format default|agent|json] [--full]
                                    Show organization details
  orgs usage <id-or-name> [--format default|agent|json]
                                    Show organization quota usage
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
      --service-ref <ref>          Service component identifier (required for create)
  -d, --data <json>                 Raw JSON body for schema/mapping/status updates

integrations options:
  -n, --name <name>                 Label (required for create)
  -t, --type <service>             Service ID from integrations types (default: notion)
      --token <token>               API token (for manual token-based integrations)
      --username <name>             WordPress username for application-password auth
      --application-password <pass> WordPress application password
      --contentful-api-mode <mode>  Contentful API mode: delivery or preview
      --contentful-delivery-token <token> Contentful Delivery API token
      --contentful-preview-token <token>  Contentful Preview API token
      --contentful-management-token <token> Contentful Management API token
      --url <url-or-id>             Service base URL or service-specific space/site ID
      --project-id <id>             Sanity project ID
      --scope <scope>               Service namespace restriction
      --scopes <scopes>             Comma-separated service namespace restrictions
      --webhook-secret <secret>     Webhook signing secret
      --webhook-header <pairs>      Webhook target static headers as Name=Value pairs
      --webhook-max-attempts <n>    Webhook target retry cap
      --webhook-delivery-window <n> Webhook target failed-delivery window
      --include-drafts              Include non-published content where the service supports it
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

incident options:
      --collection <id>             Match source or target collection
      --flow <id>                   Match flow
      --include-resolved            Include resolved incidents

resource options:
  -w, --workspace <id-or-name>      Scope integrations, collections, flows, or incidents to a workspace

output options:
  -f, --format <fmt>                Output format: default (default) | agent | json
  -a, --agent                        Use compact agent output
  -j, --json                         Use JSON output
      --full                        Include all fields with --format agent

Environment:
  CONTFU_API_KEY   API key (overrides stored config)`);
}
