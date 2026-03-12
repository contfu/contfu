import { command } from "$app/server";
import { auth } from "$lib/server/auth";
import { getUserId } from "$lib/server/user";
import * as v from "valibot";

export const createApiKey = command(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
    scope: v.picklist(["full", "read-only"]),
  }),
  async ({ name, scope }) => {
    const userId = getUserId();
    const permissions = scope === "full" ? { api: ["read", "write"] } : { api: ["read"] };
    // @ts-expect-error — Better Auth typegen doesn't expose apiKey plugin methods on auth.api
    const result = await auth.api.createApiKey({
      body: {
        name,
        userId: String(userId),
        permissions,
      },
    });
    if (!result?.key) throw new Error("Failed to create API key");
    return { key: result.key };
  },
);
