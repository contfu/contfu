import { Type } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import { BlockSchema } from "../blocks/block-schema";

const Id = Type.String({
  minLength: 32,
  maxLength: 32,
  pattern: "^[a-z0-9]+$",
});

export const PageDataSchema = Type.Object({
  id: Id,
  connection: Id,
  path: Type.Optional(Type.String()),
  title: Type.Optional(Type.String({ minLength: 1 })),
  description: Type.Optional(Type.String()),
  publishedAt: Type.Number(),
  createdAt: Type.Number(),
  updatedAt: Type.Optional(Type.Number()),
  changedAt: Type.Number(),
  collection: Type.String({ minLength: 1 }),
  content: Type.Array(BlockSchema),
  props: Type.Record(
    Type.String(),
    Type.Union([
      Type.String(),
      Type.Number(),
      Type.Boolean(),
      Type.Union([
        Type.Array(Type.String()),
        Type.Array(Type.Number()),
        Type.Array(Type.Boolean()),
      ]),
      BlockSchema,
    ])
  ),
});

export const PageDataValidator = TypeCompiler.Compile(PageDataSchema);
