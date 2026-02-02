import type { Session, User } from "@contfu/svc-backend/infra/auth/auth";

declare global {
  namespace App {
    interface Locals {
      session: Session | null;
      user: User | null;
    }
  }
}

export {};
