import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { processIconForStorage } from "$lib/server/icon-image";
import { addScannedCollections } from "@contfu/svc-backend/features/collections/addScannedCollections";
import { parseBody, AddScannedCollectionsSchema } from "../../../schemas";
import { parseIdParam, encodeAddScannedResult } from "../../../encode";

export async function POST({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "write");
  const id = parseIdParam("connection", params.id);
  const body = parseBody(AddScannedCollectionsSchema, await request.json());

  try {
    const result = await runWithUser(
      userId,
      addScannedCollections(userId, {
        connectionId: id,
        refs: body.refs,
        all: body.all,
        processIcon: processIconForStorage,
      }),
    );
    return json(encodeAddScannedResult(result), { status: 201 });
  } catch (error) {
    const tagged = error as {
      _tag?: string;
      message?: string;
      resource?: string;
      current?: number;
      max?: number;
    };
    if (tagged._tag === "NotFoundError") {
      return json({ message: "Connection not found" }, { status: 404 });
    }
    if (tagged._tag === "ValidationError") {
      return json({ message: tagged.message ?? "Invalid request" }, { status: 400 });
    }
    if (tagged._tag === "QuotaError") {
      return json(
        {
          message: `${tagged.resource} quota exceeded`,
          resource: tagged.resource,
          current: tagged.current,
          max: tagged.max,
        },
        { status: 403 },
      );
    }
    throw error;
  }
}
