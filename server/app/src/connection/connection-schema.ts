import { ConnectionConfig } from "@contfu/core";
import { TObject, Type } from "@sinclair/typebox";
import { NotionConnection } from "./notion/notion-connection";

const CollectionBaseSchema = Type.Object({
  lastUpdate: Type.Optional(Type.String()),
});

function buildConnectionSchema<
  T extends string,
  Con extends TObject,
  Col extends TObject
>({
  type,
  connection,
  collections,
}: {
  type: T;
  connection: Con;
  collections: Col;
}) {
  return Type.Composite([
    Type.Object({
      id: Type.String(),
      key: Type.String(),
      type: Type.Literal(type),
      collections: Type.Record(
        Type.String(),
        Type.Composite([CollectionBaseSchema, collections])
      ),
    }),
    connection,
  ]);
}

const NotionConnectionSchema = buildConnectionSchema({
  type: "notion",
  connection: Type.Object({
    notionKey: Type.String(),
  }),
  collections: Type.Object({
    dbId: Type.String(),
  }),
});

export const ConnectionSchema = Type.Union([NotionConnectionSchema]);

export function buildConnection(settings: ConnectionConfig<any>) {
  switch (settings.type) {
    case "notion":
      return new NotionConnection(settings);
  }
}
