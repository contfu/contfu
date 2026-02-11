import { db } from "../../infra/db/db";
import { settingTable } from "../../infra/db/schema";

/**
 * Create or update a system setting.
 */
export async function upsertSetting(key: string, value: Buffer): Promise<void> {
  await db
    .insert(settingTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingTable.key,
      set: { value, updatedAt: new Date() },
    });
}
