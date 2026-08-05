import { epochDayToIsoDate, epochDayToMilliseconds } from "./time";
import { PropertyType, propertyTypeBase, schemaType, type CollectionSchema } from "./schemas";

export type PlainDateOutput = "string" | "milliseconds";

/** Format PLAINDATE properties on schema-tagged public query results, including relations. */
export function formatPlainDateResults<T>(
  value: T,
  schemas: ReadonlyMap<string, CollectionSchema> | Record<string, CollectionSchema>,
  output: PlainDateOutput = "string",
): T {
  const schemaFor = (name: string) =>
    schemas instanceof Map
      ? schemas.get(name)
      : (schemas as Record<string, CollectionSchema>)[name];
  const seen = new WeakSet<object>();

  const visit = (entry: unknown): void => {
    if (!entry || typeof entry !== "object") return;
    if (seen.has(entry)) return;
    seen.add(entry);
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item);
      return;
    }
    const item = entry as Record<string, unknown>;
    const collection = item.$collection;
    const schema = typeof collection === "string" ? schemaFor(collection) : undefined;
    if (schema) {
      for (const key in schema) {
        const epochDay = item[key];
        if (
          (propertyTypeBase(schemaType(schema[key])) & PropertyType.PLAINDATE) !== 0 &&
          typeof epochDay === "number"
        ) {
          item[key] =
            output === "milliseconds"
              ? epochDayToMilliseconds(epochDay)
              : epochDayToIsoDate(epochDay);
        }
      }
    }
    for (const nested of Object.values(item)) visit(nested);
  };

  visit(value);
  return value;
}
