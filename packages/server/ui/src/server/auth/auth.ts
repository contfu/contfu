import type { RequestEvent } from "@builder.io/qwik-city";
import { error } from "node:console";

export type DisplayUser = { email: string; name: string };

export const SESSION_COOKIE_NAME = "s";

export function getUser({
  sharedMap,
}: Pick<RequestEvent, "sharedMap">): DisplayUser | null {
  return sharedMap.get("user") ?? null;
}

export function guardLoggedIn({
  sharedMap,
  redirect,
}: Pick<RequestEvent, "sharedMap" | "redirect">) {
  const user = sharedMap.get("user");
  if (!user) throw redirect(302, "/login");
}

export function guardLoggedOut({
  sharedMap,
  redirect,
  method,
}: Pick<RequestEvent, "sharedMap" | "redirect" | "method">) {
  const user = sharedMap.get("user");
  if (user) {
    if (method === "GET") throw redirect(302, "/dashboard");
    else throw error(403, "Forbidden");
  }
}
