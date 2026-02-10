import { auth } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => auth.handler(request);
export const POST: RequestHandler = async ({ request }) => auth.handler(request);
