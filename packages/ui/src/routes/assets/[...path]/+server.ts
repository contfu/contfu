import { proxyToServer } from "$lib/server/proxy";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => proxyToServer(request, url);
