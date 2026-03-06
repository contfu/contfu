/** Source type identifiers.
 * 1–19: Custom resources (web crawl, etc.)
 * 20+:  Hosted services (Notion, Strapi, Contentful, …)
 */
export const SourceType = {
  WEB: 1,
  NOTION: 20,
  STRAPI: 21,
  CONTENTFUL: 22,
} as const;
