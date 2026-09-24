/** Public identity of a managed item delivered into an application collection. */
export type ItemIdentity = [collection: string, id: number];

export function isItemIdentity(value: unknown): value is ItemIdentity {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    value[0].length > 0 &&
    typeof value[1] === "number" &&
    Number.isSafeInteger(value[1]) &&
    value[1] > 0
  );
}

/** Canonical key for maps/sets; delimiter concatenation is not collision safe. */
export function itemIdentityKey(identity: ItemIdentity): string {
  if (!isItemIdentity(identity)) throw new TypeError("Invalid collection-scoped item identity");
  return JSON.stringify(identity);
}

export function sameItemIdentity(left: ItemIdentity, right: ItemIdentity): boolean {
  return left[0] === right[0] && left[1] === right[1];
}
