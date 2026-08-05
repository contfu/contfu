export function enumFallback(value: unknown): string {
  return `unknown(${String(value)})`;
}

export function enumKeyLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

export function translateEnum(value: unknown, values: Record<string, number>): string {
  if (typeof value === "string") return value;
  const key = Object.entries(values).find(([, enumValue]) => enumValue === value)?.[0];
  return key === undefined ? enumFallback(value) : enumKeyLabel(key);
}
