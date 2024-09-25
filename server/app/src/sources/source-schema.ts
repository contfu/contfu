import { SourceConfig } from "@contfu/core";
import { t, TSchema } from "elysia";
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
