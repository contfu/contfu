import type { RequestEvent } from "@builder.io/qwik-city";
import type { Session } from "./session";

export type DisplayUser = { email: string; name: string };

export const SESSION_COOKIE_NAME = "s";

export function getSession({
  sharedMap,
}: Pick<RequestEvent, "sharedMap">): Session | null {
  return sharedMap.get("session") ?? null;
}

export function guardLoggedIn({
  sharedMap,
  redirect,
}: Pick<RequestEvent, "sharedMap" | "redirect">) {
  if (!getSession({ sharedMap })) throw redirect(302, "/login");
}

export function guardLoggedOut({
  sharedMap,
  redirect,
  method,
  error,
}: Pick<RequestEvent, "sharedMap" | "redirect" | "method" | "error">) {
  if (getSession({ sharedMap })) {
    if (method === "GET") throw redirect(302, "/dashboard");
    else throw error(403, "Forbidden");
  }
}
