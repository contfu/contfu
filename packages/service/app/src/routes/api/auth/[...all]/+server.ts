import { auth } from "@contfu/svc-backend/infra/auth/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => auth.handler(request);
export const POST: RequestHandler = async ({ request }) => auth.handler(request);
