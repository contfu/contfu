import type { Session } from "$lib/server/auth/session";

declare global {
  namespace App {
    interface Locals {
      session: Session | null;
    }
  }
}

export {};
