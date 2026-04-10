import { json } from "@sveltejs/kit";
import { authenticateApiKey } from "$lib/server/auth";
import { runWithUser } from "$lib/server/run";
import { scanCollections } from "@contfu/svc-backend/features/collections/scanCollections";
import { parseIdParam } from "../../../encode";

export async function GET({ request, params }: { request: Request; params: { id: string } }) {
  const { userId } = await authenticateApiKey(request, "read");
  const id = parseIdParam("connection", params.id);

  try {
    const result = await runWithUser(userId, scanCollections(id));
    return json(result);
  } catch (error) {
    const tagged = error as { _tag?: string; message?: string };
    if (tagged._tag === "NotFoundError") {
      return json({ message: "Connection not found" }, { status: 404 });
    }
    if (tagged._tag === "ValidationError") {
      return json({ message: tagged.message ?? "Invalid request" }, { status: 400 });
    }
    throw error;
  }
}
