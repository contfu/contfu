import { Block } from "@contfu/core";
import { Static, Type } from "@sinclair/typebox";
import { Equals } from "../tools";

const String = Type.String();
const TextSchema = Type.Union([
  Type.Tuple([Type.Literal("a"), String, String]),
  Type.Tuple([Type.Literal("c"), String]),
  Type.Tuple([Type.Literal("b"), String]),
  Type.Tuple([Type.Literal("i"), String]),
  String,
]);

export const BlockSchema = Type.Recursive((Block) => {
  const Texts = Type.Array(TextSchema);
  const Blocks = Type.Array(Block);
  const BlockOrText = Type.Union([Block, TextSchema]);
  const BlocksOrTexts = Type.Array(BlockOrText);
  return Type.Union([
    Type.Tuple([
      Type.Literal("q"),
      Type.Array(Type.Union([TextSchema, Block])),
    ]),
    Type.Tuple([Type.Literal("p"), Texts]),
    Type.Tuple([Type.Literal("c"), String, String]),
    Type.Tuple([Type.Literal("1"), Texts]),
    Type.Tuple([Type.Literal("2"), Texts]),
    Type.Tuple([Type.Literal("3"), Texts]),
    Type.Tuple([Type.Literal("u"), BlocksOrTexts]),
    Type.Tuple([Type.Literal("o"), BlocksOrTexts]),
    Type.Tuple([
      Type.Literal("t"),
      Type.Boolean(),
      Type.Array(Type.Array(BlocksOrTexts)),
    ]),
    Type.Tuple([Type.Literal("i"), String, String, Type.Array(Type.Number())]),
    Type.Tuple([
      Type.Literal("x"),
      String,
      Type.Record(String, Type.Any()),
      Blocks,
    ]),
  ]);
});

const _: Equals<Static<typeof BlockSchema>, Block> = true;
