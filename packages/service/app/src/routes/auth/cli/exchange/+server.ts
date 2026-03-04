import { consumeCliToken } from "$lib/server/cli-token-store";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ url }) => {
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const token = consumeCliToken(code);
  if (!token) {
    return new Response("Invalid or expired code", { status: 404 });
  }

  return Response.json({ token });
};
