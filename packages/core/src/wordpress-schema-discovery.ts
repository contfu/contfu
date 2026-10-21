/** Passive discovery evidence, not a promise that arbitrary plugin fields are complete. */
export type WordPressSchemaDiscovery = {
  sampleCapped: boolean;
  sampleOnlyFieldCount: number;
  /** Normalized fields whose current types came from route metadata. */
  declaredFields: string[];
};

export function wordPressSchemaDiscovery(
  options: Record<string, unknown> | null | undefined,
): WordPressSchemaDiscovery | undefined {
  const value = options?.wordPressSchemaDiscovery;
  if (!value || typeof value !== "object") return undefined;
  const evidence = value as WordPressSchemaDiscovery;
  if (
    typeof evidence.sampleCapped !== "boolean" ||
    !Number.isSafeInteger(evidence.sampleOnlyFieldCount) ||
    evidence.sampleOnlyFieldCount < 0 ||
    !Array.isArray(evidence.declaredFields) ||
    !evidence.declaredFields.every((field) => typeof field === "string")
  )
    return undefined;
  return evidence;
}

export function wordPressSchemaDiscoveryNote(
  options: Record<string, unknown> | null | undefined,
): string | undefined {
  const evidence = wordPressSchemaDiscovery(options);
  if (!evidence?.sampleCapped) return undefined;
  return `WordPress schema sample capped at 100 records. Route declarations take precedence; ${evidence.sampleOnlyFieldCount} sample-only field${evidence.sampleOnlyFieldCount === 1 ? " is" : "s are"} best-effort. Unregistered plugin fields or enum values may be missing.`;
}
