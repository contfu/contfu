import { SourceConfig } from "@contfu/core";
import { TObject, Type } from "@sinclair/typebox";
import { NotionSource } from "./notion/notion-source";

const CollectionBaseSchema = Type.Object({
  id: Type.Number(),
  lastUpdate: Type.Optional(Type.String()),
});

function buildSourceSchema<
  T extends string,
  Con extends TObject,
  Col extends TObject
>({ type, source, collections }: { type: T; source: Con; collections: Col }) {
  return Type.Composite([
    Type.Object({
      id: Type.Number(),
      key: Type.String(),
      type: Type.Literal(type),
      collections: Type.Array(
        Type.Composite([CollectionBaseSchema, collections])
      ),
    }),
    source,
  ]);
}

const NotionSourceSchema = buildSourceSchema({
  type: "notion",
  source: Type.Object({
    notionKey: Type.String(),
  }),
  collections: Type.Object({
    dbId: Type.String(),
    content: Type.Optional(Type.String()),
  }),
});

export const SourceSchema = Type.Union([NotionSourceSchema]);

export function buildSource(settings: SourceConfig) {
  switch (settings.type) {
    case "notion":
      return new NotionSource(settings);
  }
}
