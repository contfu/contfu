import {
  CollectionConfig,
  Item,
  PageValidationError,
  SourceConfig,
} from "@contfu/core";
import { t, TSchema } from "elysia";
import { Observable } from "rxjs";
import { NotionSource } from "./notion/notion-source";

const CollectionBaseSchema = t.Object({
  id: t.Number(),
  lastUpdate: t.Optional(t.String()),
});

function buildSourceSchema<
  T extends string,
  Con extends TSchema,
  Col extends TSchema
>({ type, source, collections }: { type: T; source: Con; collections: Col }) {
  return t.Composite([
    t.Object({
      id: t.Number(),
      key: t.String(),
      type: t.Literal(type),
      collections: t.Array(t.Composite([CollectionBaseSchema, collections])),
    }),
    source,
  ]);
}

const NotionSourceSchema = buildSourceSchema({
  type: "notion",
  source: t.Object({
    notionKey: t.String(),
  }),
  collections: t.Object({
    dbId: t.String(),
    content: t.Optional(t.String()),
  }),
});

export const SourceSchema = t.Union([NotionSourceSchema]);

export function buildSource(settings: SourceConfig) {
  switch (settings.type) {
    case "notion":
      return new NotionSource(settings);
  }
}

export type Source<C extends CollectionConfig> = {
  id: number;
  /**
   * Loads all ids of the collection from the connection target.
   *
   * @param collection The collection to get references for.
   */
  pullCollectionIds(collection: C): Observable<string[]>;
  /**
   * Pulls content from the connection target.
   */
  pull(collection: C, since?: number): Observable<Item | PageValidationError>;
  // TODO: Move to client
  /**
   * Fetches an asset from the connection target.
   *
   * @param ref The reference to the asset.
   */
  fetchAsset(
    ref: string
  ): Promise<ReadableStream | Buffer> | ReadableStream | Buffer;
};
