export type ObjectEqualityOptions = {
  depth?: number;
};

export function isObjectEqual(
  a: unknown,
  b: unknown,
  options: ObjectEqualityOptions = {},
): boolean {
  return isEqual(a, b, options.depth ?? Number.POSITIVE_INFINITY);
}

function isEqual(a: unknown, b: unknown, depth: number): boolean {
  if (Object.is(a, b)) return true;
  if (depth <= 0) return false;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((entry, index) => isEqual(entry, b[index], depth - 1))
    );
  }

  const aEntries = Object.entries(a as Record<string, unknown>);
  const bRecord = b as Record<string, unknown>;
  if (aEntries.length !== Object.keys(bRecord).length) return false;
  return aEntries.every(
    ([key, value]) =>
      Object.prototype.hasOwnProperty.call(bRecord, key) && isEqual(value, bRecord[key], depth - 1),
  );
}
