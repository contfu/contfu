/**
 * Admin endpoint for setting a user's base plan.
 * Admin auth is enforced centrally in hooks.server.ts for /api/admin/* routes.
 */
import { json, error } from "@sveltejs/kit";
import { run } from "$lib/server/run";
import { setBasePlan } from "@contfu/svc-backend/features/admin/setBasePlan";
import { PlanTier } from "@contfu/svc-backend/infra/polar/products";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { userId, basePlan } = await request.json();
  if (typeof userId !== "number" || typeof basePlan !== "number") {
    error(400, "userId and basePlan must be numbers");
  }
  const validPlans = [PlanTier.FREE, PlanTier.STARTER, PlanTier.PRO, PlanTier.BUSINESS];
  if (!validPlans.includes(basePlan)) {
    error(400, "Invalid plan tier");
  }

  const result = await run(setBasePlan({ userId, basePlan: basePlan as PlanTier }));
  if (!result) {
    error(404, "User not found");
  }

  return json({ success: true });
};
