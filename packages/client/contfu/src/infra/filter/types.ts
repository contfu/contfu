export const TokenType = {
  String: 1,
  Number: 2,
  Boolean: 3,
  Null: 4,
  Identifier: 5,
  SystemField: 6,
  Eq: 7,
  Neq: 8,
  Gt: 9,
  Gte: 10,
  Lt: 11,
  Lte: 12,
  Like: 13,
  NotLike: 14,
  ArrayContains: 15,
  And: 16,
  Or: 17,
  LParen: 18,
  RParen: 19,
  Comma: 20,
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export type Token = {
  type: TokenType;
  value: string;
};

export type ComparisonOp = "=" | "!=" | ">" | ">=" | "<" | "<=" | "~" | "!~" | "?=";

export type ComparisonNode = {
  kind: "comparison";
  field: string;
  op: ComparisonOp;
  value: string | number | boolean | null;
};

export type AndNode = {
  kind: "and";
  left: FilterAST;
  right: FilterAST;
};

export type OrNode = {
  kind: "or";
  left: FilterAST;
  right: FilterAST;
};

export type GroupNode = {
  kind: "group";
  expr: FilterAST;
};

export type FunctionCallNode = {
  kind: "function";
  name: string;
  args: string[];
  op: ComparisonOp;
  value: string | number | boolean | null;
};

export type FilterAST = ComparisonNode | AndNode | OrNode | GroupNode | FunctionCallNode;
