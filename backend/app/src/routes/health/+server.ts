import type { RequestHandler } from "./$types";

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { status: 204 });
};
