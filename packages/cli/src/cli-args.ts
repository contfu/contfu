import { parseArgs } from "node:util";
import { bool, fail, str, type ParsedValues } from "./command-context";
import { isOutputFormat, type OutputFormat } from "./output";
import type { CliValues } from "./commands/resources";

const STRING_OPTIONS = [
  "data",
  "name",
  "type",
  "url",
  "display-name",
  "source-id",
  "target-id",
  "integration-id",
  "token",
  "username",
  "application-password",
  "contentful-api-mode",
  "contentful-delivery-token",
  "contentful-preview-token",
  "contentful-management-token",
  "project-id",
  "scope",
  "scopes",
  "webhook-secret",
  "webhook-header",
  "webhook-max-attempts",
  "webhook-delivery-window",
  "service-ref",
  "locale",
  "fallback",
  "i18n-locales",
  "i18n-active-locales",
  "i18n-locale-map",
  "i18n-locale-field",
  "i18n-grouping-key",
  "format",
  "package",
  "app-name",
  "env-file",
  "refs",
  "workspace",
  "organization",
  "email",
  "role",
  "integrations",
  "collections",
  "flows",
  "items",
  "item-changes",
  "collection",
  "flow",
] as const;

const BOOLEAN_OPTIONS = [
  "help",
  "no-browser",
  "content",
  "no-content",
  "generate-key",
  "i18n-keep-raw-field",
  "i18n-drop-raw-field",
  "reset-i18n",
  "include-drafts",
  "no-include-drafts",
  "agent",
  "json",
  "full",
  "non-interactive",
  "all",
  "select",
  "dry-run",
  "include-resolved",
  "wait",
  "refresh-source-first",
] as const;

const SHORT_FLAGS: Record<string, string> = {
  help: "h",
  data: "d",
  type: "t",
  format: "f",
  agent: "a",
  json: "j",
  select: "s",
  workspace: "w",
  organization: "o",
  name: "n",
};

function optionSpec() {
  const options: Record<string, { type: "string" | "boolean"; short?: string }> = {};
  for (const name of STRING_OPTIONS) {
    options[name] = { type: "string", ...(SHORT_FLAGS[name] ? { short: SHORT_FLAGS[name] } : {}) };
  }
  for (const name of BOOLEAN_OPTIONS) {
    options[name] = { type: "boolean", ...(SHORT_FLAGS[name] ? { short: SHORT_FLAGS[name] } : {}) };
  }
  return options;
}

export class CliParseError extends Error {
  constructor() {
    super("Invalid command-line options");
    this.name = "CliParseError";
  }
}

/**
 * Find the `items` command from parseArgs' token stream so option values such
 * as `--name items` are not mistaken for commands.
 */
function findItemsCommandIndex(argv: string[]): number | undefined {
  const { tokens } = parseArgs({
    args: argv,
    options: optionSpec(),
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  return tokens.find((token) => token.kind === "positional" && token.value === "items")?.index;
}

export function parseCliArgs(argv: string[]) {
  try {
    const commandIndex = findItemsCommandIndex(argv);
    const isItemsCommand = commandIndex !== undefined;
    const topLevelArgs = isItemsCommand ? argv.slice(0, commandIndex) : argv;
    const { values, positionals } = parseArgs({
      args: topLevelArgs,
      options: optionSpec(),
      allowPositionals: true,
      strict: true,
    });
    return {
      values: values as ParsedValues,
      positionals: isItemsCommand ? ["items"] : positionals,
      itemsArgs: isItemsCommand ? argv.slice(commandIndex + 1) : undefined,
    };
  } catch {
    throw new CliParseError();
  }
}

/**
 * Resolve `--format` and the `-a` / `-j` shortcuts into a single format,
 * exiting when they conflict or name an unknown format.
 */
export function resolveOutputFormat(values: ParsedValues): OutputFormat {
  const requested = str(values, "format");
  if (requested !== undefined && !isOutputFormat(requested)) {
    fail(`Unsupported output format: ${requested}. Use default, agent, or json.`);
  }

  const shortcuts = [values.agent ? "agent" : undefined, values.json ? "json" : undefined].filter(
    (format): format is OutputFormat => format !== undefined,
  );
  if (shortcuts.length > 1 || (requested !== undefined && shortcuts.length > 0)) {
    fail("Choose only one output format via --format, -a, or -j.");
  }

  return requested ?? shortcuts[0] ?? "default";
}

const CLI_VALUE_STRING_KEYS = [
  "name",
  "type",
  "url",
  "display-name",
  "source-id",
  "target-id",
  "integration-id",
  "token",
  "username",
  "application-password",
  "contentful-api-mode",
  "contentful-delivery-token",
  "contentful-preview-token",
  "contentful-management-token",
  "project-id",
  "scope",
  "scopes",
  "webhook-secret",
  "webhook-header",
  "webhook-max-attempts",
  "webhook-delivery-window",
  "i18n-locales",
  "i18n-active-locales",
  "i18n-locale-map",
  "i18n-locale-field",
  "i18n-grouping-key",
] as const;

const CLI_VALUE_BOOLEAN_KEYS = [
  "content",
  "no-content",
  "generate-key",
  "i18n-keep-raw-field",
  "i18n-drop-raw-field",
  "reset-i18n",
  "include-drafts",
  "no-include-drafts",
] as const;

/** Narrow the loosely typed `parseArgs` output into the resource command shape. */
export function toCliValues(values: ParsedValues): CliValues {
  const cliValues: Record<string, string | boolean | undefined> = {};
  for (const key of CLI_VALUE_STRING_KEYS) cliValues[key] = str(values, key);
  for (const key of CLI_VALUE_BOOLEAN_KEYS) cliValues[key] = bool(values, key);
  return cliValues as CliValues;
}
