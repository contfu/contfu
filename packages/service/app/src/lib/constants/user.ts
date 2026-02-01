// Re-export UserRole from backend constants
// Note: This is duplicated here for client-side usage since the backend package
// is server-only. Keep in sync with @contfu/svc-backend/infra/db/constants.

/** User roles: 0 = user, 1 = admin */
export const UserRole = {
  USER: 0,
  ADMIN: 1,
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
