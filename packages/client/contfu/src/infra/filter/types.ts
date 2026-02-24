export const TokenType = {
  String: 1,
  Number: 2,
  Boolean: 3,
  Null: 4,
  Identifier: 5,
  Eq: 6,
  Neq: 7,
  Gt: 8,
  Gte: 9,
  Lt: 10,
  Lte: 11,
  Like: 12,
  NotLike: 13,
  ArrayContains: 14,
  And: 15,
  Or: 16,
  LParen: 17,
  RParen: 18,
  Comma: 19,
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
