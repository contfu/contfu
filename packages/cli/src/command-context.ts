import type { OutputFormat } from "./output";

/** Raw `parseArgs` values. `strict: false` means every value is loosely typed. */
export type ParsedValues = Record<string, string | boolean | undefined>;

/**
 * Everything a command handler needs, derived once in `main` so individual
 * handlers stay free of argument plumbing.
 */
export interface CommandContext {
  values: ParsedValues;
  positionals: string[];
  outputFormat: OutputFormat;
  full: boolean | undefined;
  dryRun: boolean;
}

/** A handler for one `<command> <action>` pair. */
export type ActionHandler = (ctx: CommandContext) => Promise<void> | void;

export function str(values: ParsedValues, key: string): string | undefined {
  const value = values[key];
  return typeof value === "string" ? value : undefined;
}

export function bool(values: ParsedValues, key: string): boolean | undefined {
  const value = values[key];
  return typeof value === "boolean" ? value : undefined;
}

/** Print `message` on stderr and exit non-zero. Never returns. */
export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Return `ref`, or exit with `usage` when it was omitted. */
export function requireRef(ref: string | undefined, usage: string): string {
  if (!ref) fail(usage);
  return ref;
}

/**
 * Run the handler registered for `action`, or exit with an unknown-action
 * error naming the command group.
 */
export async function dispatchAction(
  group: string,
  handlers: Record<string, ActionHandler>,
  action: string,
  ctx: CommandContext,
): Promise<void> {
  const handler = handlers[action];
  if (!handler) fail(`Unknown ${group} action: ${action}`);
  await handler(ctx);
}
