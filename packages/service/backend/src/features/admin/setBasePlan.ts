import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { quotaTable, userTable } from "../../infra/db/schema";
import { type PlanTier, getQuotaForTier } from "../../infra/polar/products";
import { evictCachedQuota, publishLimitChange } from "../../infra/cache/quota-cache";

export interface SetBasePlanDto {
  userId: number;
  basePlan: PlanTier;
}

const INACTIVE_STATUSES = new Set([null, "canceled", "revoked", "incomplete_expired"]);

export const setBasePlan = (dto: SetBasePlanDto) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [existing] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            subscriptionStatus: quotaTable.subscriptionStatus,
          })
          .from(userTable)
          .leftJoin(quotaTable, eq(userTable.id, quotaTable.id))
          .where(eq(userTable.id, dto.userId))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!existing) return null;

    yield* Effect.tryPromise({
      try: () =>
        db.update(userTable).set({ basePlan: dto.basePlan }).where(eq(userTable.id, dto.userId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const quota = getQuotaForTier(dto.basePlan);
    const hasActiveSubscription = !INACTIVE_STATUSES.has(existing.subscriptionStatus);

    if (!hasActiveSubscription) {
      const limits = {
        maxConnections: quota.maxConnections,
        maxCollections: quota.maxCollections,
        maxFlows: quota.maxFlows,
        maxItems: quota.maxItems,
      };

      yield* Effect.tryPromise({
        try: () =>
          db
            .insert(quotaTable)
            .values({ id: dto.userId, ...limits })
            .onConflictDoUpdate({ target: quotaTable.id, set: limits })
            .returning({ id: quotaTable.id }),
        catch: (e) => new DatabaseError({ cause: e }),
      });

      evictCachedQuota(existing.id);
      publishLimitChange(existing.id, limits);
    }

    return { success: true };
  }).pipe(Effect.withSpan("admin.setBasePlan", { attributes: { userId: dto.userId } }));
