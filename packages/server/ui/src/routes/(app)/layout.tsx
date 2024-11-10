import type { RequestHandler } from "@builder.io/qwik-city";
import { guardLoggedIn } from "~/server/auth/auth";

export const onRequest: RequestHandler = async (event) => {
  guardLoggedIn(event);
};
