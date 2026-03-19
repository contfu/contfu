import type { RequestHandler } from "./$types";

export const OPTIONS: RequestHandler = () => {
  return new Response(null, { status: 204 });
};

export const GET: RequestHandler = () => {
  return new Response(null, { status: 204 });
};
