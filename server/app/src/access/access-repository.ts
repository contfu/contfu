import { eq } from "drizzle-orm";
import { withSchema } from "../core/db";
import { account } from "./access-db";

const db = withSchema({ account });

export async function authenticate(key: Buffer) {
  const acc = await db.query.account.findFirst({ where: eq(account.key, key) });
  return !!acc;
}
