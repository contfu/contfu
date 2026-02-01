/** User roles: 0 = user, 1 = admin */
export const UserRole = {
  USER: 0,
  ADMIN: 1,
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
