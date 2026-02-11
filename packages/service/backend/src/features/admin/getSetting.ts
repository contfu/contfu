import { db } from "../../infra/db/db";
import { settingTable } from "../../infra/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get a system setting by key.
 * Returns the raw value (may be encrypted).
 */
export async function getSetting(key: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ value: settingTable.value })
    .from(settingTable)
    .where(eq(settingTable.key, key))
    .limit(1);
  return (row?.value as Buffer | null) ?? null;
}
