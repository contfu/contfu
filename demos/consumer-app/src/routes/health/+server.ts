import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async () => {
  return new Response("OK", {
    headers: { "Content-Type": "text/plain" },
  });
};
