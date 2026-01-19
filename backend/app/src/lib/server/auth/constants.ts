// Auth constants - separate file to avoid circular dependencies with db.ts
export const SESSION_TOKEN_LENGTH = 24;
export const SESSION_COOKIE_NAME = "s";
export const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30; // 30 days
