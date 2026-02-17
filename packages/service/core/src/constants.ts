/** Source type identifiers. */
export const SourceType = {
  NOTION: 0,
  STRAPI: 1,
  WEB: 2,
} as const;

/** Credentials source identifiers. */
export const CredentialsSource = {
  USER_PROVIDED: 0,
  OAUTH: 1,
} as const;

export type CredentialsSource = (typeof CredentialsSource)[keyof typeof CredentialsSource];
