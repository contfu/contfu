export type { Source, CollectionFetchOpts } from "./source";
export { genUid, uuidToBuffer, ITEM_ID_SIZE } from "./util/ids";
export {
  notionRefUrlFromRawUuid,
  strapiRefUrl,
  contentfulRefUrl,
  webRefUrl,
  getItemRefForSource,
} from "./refs";
export { NotionSource } from "./notion/notion-source";
export { StrapiSource } from "./strapi/strapi-source";
export { ContentfulSource } from "./contentful/contentful-source";
export { WebSource } from "./web/web-source";

import { NotionSource } from "./notion/notion-source";
import { StrapiSource } from "./strapi/strapi-source";
import { ContentfulSource } from "./contentful/contentful-source";
import { WebSource } from "./web/web-source";

export const notionSource = new NotionSource();
export const strapiSource = new StrapiSource();
export const contentfulSource = new ContentfulSource();
export const webSource = new WebSource();
