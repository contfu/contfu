import type { Actions, PageServerLoad } from "./$types";
import { db } from "@contfu/svc-backend/infra/db/db";
import { collectionTable, influxTable } from "@contfu/svc-backend/infra/db/schema";
import { and, eq } from "drizzle-orm";
import { updateInflux } from "@contfu/svc-backend/features/influxes/updateInflux";
import { listInfluxes } from "@contfu/svc-backend/features/influxes/listInfluxes";
import { fail, redirect } from "@sveltejs/kit";
import type { Filter } from "@contfu/core";

// Re-export db and eq for form action use
// (imported at module level to avoid async import issues)

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) {
    redirect(302, "/login");
  }

  const collectionId = parseInt(params.id, 10);
  if (!Number.isFinite(collectionId)) {
    return { collection: null, influxes: [] };
  }

  // Get collection
  const [collection] = await db
    .select()
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, user.id), eq(collectionTable.id, collectionId)));

  if (!collection) {
    return { collection: null, influxes: [] };
  }

  // Get influxes for this collection
  const influxes = await listInfluxes(user.id, collectionId);

  return {
    collection,
    influxes,
  };
};

export const actions: Actions = {
  updateSourceCollectionMapping: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Unauthorized" });
    }

    const formData = await request.formData();
    const collectionId = parseInt(params.id, 10);
    const sourceCollectionId = parseInt(formData.get("sourceCollectionId") as string, 10);
    const filtersJson = formData.get("filters") as string;

    if (!Number.isFinite(collectionId) || !Number.isFinite(sourceCollectionId)) {
      return fail(400, { error: "Invalid collection or source collection ID" });
    }

    let filters: Filter[] | null = null;
    if (filtersJson) {
      try {
        filters = JSON.parse(filtersJson);
      } catch {
        return fail(400, { error: "Invalid filters JSON" });
      }
    }

    // Find influx by collectionId + sourceCollectionId and update it
    const [influx] = await db
      .select({ id: influxTable.id })
      .from(influxTable)
      .where(
        and(
          eq(influxTable.userId, user.id),
          eq(influxTable.collectionId, collectionId),
          eq(influxTable.sourceCollectionId, sourceCollectionId),
        ),
      );

    if (!influx) {
      return fail(404, { error: "Influx not found" });
    }

    const result = await updateInflux(user.id, {
      id: influx.id,
      filters,
    });

    if (!result) {
      return fail(500, { error: "Failed to update influx" });
    }

    return { success: true };
  },
};
