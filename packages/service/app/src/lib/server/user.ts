import { getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import type { User } from "@contfu/svc-backend/infra/auth/auth";

export function getUser(): User {
  const event = getRequestEvent();
  const user = event.locals.user;
  if (!user) {
    throw redirect(302, "/login");
  }
  return user;
}

export function getUserId(): number {
  const user = getUser();
  return Number(user.id);
}
