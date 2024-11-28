import type { RequestHandler } from "@builder.io/qwik-city";

export const onOptions: RequestHandler = async ({ send }) => {
  send(new Response(null, { status: 204 }));
};
