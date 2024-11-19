import type { RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler = async (event) => {
  const { guardLoggedIn } = await import("~/server/auth/session");
  guardLoggedIn(event);
};
