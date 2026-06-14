const SECRET_KEYS = /(?:key|token|secret|credential|password)/i;

export function redactDryRunValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDryRunValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SECRET_KEYS.test(key) ? "[redacted]" : redactDryRunValue(nested),
      ]),
    );
  }
  return value;
}

export function printDryRun(action: string, details?: unknown): void {
  console.log(`Dry run: would ${action}`);
  if (details !== undefined) console.log(JSON.stringify(redactDryRunValue(details), null, 2));
}

export interface DryRunOption {
  dryRun?: boolean;
}
