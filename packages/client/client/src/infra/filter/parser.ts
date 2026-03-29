import { TokenType, type ComparisonOp, type FilterAST, type Token } from "./types";

const OP_TOKEN_MAP: Record<number, ComparisonOp> = {
  [TokenType.Eq]: "=",
  [TokenType.Neq]: "!=",
  [TokenType.Gt]: ">",
  [TokenType.Gte]: ">=",
  [TokenType.Lt]: "<",
  [TokenType.Lte]: "<=",
  [TokenType.Like]: "~",
  [TokenType.NotLike]: "!~",
  [TokenType.ArrayContains]: "?=",
};

export function parse(tokens: Token[]): FilterAST {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function expect(type: TokenType): Token {
    const t = peek();
    if (!t || t.type !== type) {
      throw new Error(`Expected token type ${type}, got ${t ? t.type : "EOF"} at position ${pos}`);
    }
    return advance();
  }

  function expectArg(): Token {
    const t = peek();
    if (
      t &&
      (t.type === TokenType.Identifier ||
        t.type === TokenType.SystemField ||
        t.type === TokenType.String)
    ) {
      return advance();
    }
    throw new Error(
      `Expected identifier, system field, or string argument, got ${t ? t.type : "EOF"} at position ${pos}`,
    );
  }

  function parseOr(): FilterAST {
    let left = parseAnd();
    while (peek()?.type === TokenType.Or) {
      advance();
      const right = parseAnd();
      left = { kind: "or", left, right };
    }
    return left;
  }

  function parseAnd(): FilterAST {
    let left = parsePrimary();
    while (peek()?.type === TokenType.And) {
      advance();
      const right = parsePrimary();
      left = { kind: "and", left, right };
    }
    return left;
  }

  function parsePrimary(): FilterAST {
    const t = peek();

    if (!t) {
      throw new Error("Unexpected end of input");
    }

    // Parenthesized group
    if (t.type === TokenType.LParen) {
      advance();
      const expr = parseOr();
      expect(TokenType.RParen);
      return { kind: "group", expr };
    }

    // Identifier — could be a field comparison or function call
    if (t.type === TokenType.Identifier || t.type === TokenType.SystemField) {
      const ident = advance();

      // Check for function call: identifier followed by (
      if (peek()?.type === TokenType.LParen) {
        advance(); // consume (
        const args: string[] = [];
        if (peek()?.type !== TokenType.RParen) {
          args.push(expectArg().value);
          while (peek()?.type === TokenType.Comma) {
            advance();
            args.push(expectArg().value);
          }
        }
        expect(TokenType.RParen);

        const opToken = peek();
        if (!opToken || !(opToken.type in OP_TOKEN_MAP)) {
          throw new Error(`Expected operator after function call at position ${pos}`);
        }
        const op = OP_TOKEN_MAP[advance().type];
        const value = parseValue();

        return { kind: "function", name: ident.value, args, op, value };
      }

      // Regular comparison: field op value
      const opToken = peek();
      if (!opToken || !(opToken.type in OP_TOKEN_MAP)) {
        throw new Error(`Expected operator after field "${ident.value}" at position ${pos}`);
      }
      const op = OP_TOKEN_MAP[advance().type];
      const value = parseValue();

      return { kind: "comparison", field: ident.value, op, value };
    }

    throw new Error(`Unexpected token: ${t.value} at position ${pos}`);
  }

  function parseValue(): string | number | boolean | null {
    const t = peek();
    if (!t) throw new Error("Unexpected end of input, expected value");

    if (t.type === TokenType.String) {
      advance();
      return t.value;
    }
    if (t.type === TokenType.Number) {
      advance();
      return t.value.includes(".") ? parseFloat(t.value) : parseInt(t.value, 10);
    }
    if (t.type === TokenType.Boolean) {
      advance();
      return t.value === "true";
    }
    if (t.type === TokenType.Null) {
      advance();
      return null;
    }

    throw new Error(`Expected value, got "${t.value}" at position ${pos}`);
  }

  const ast = parseOr();

  if (pos < tokens.length) {
    throw new Error(`Unexpected token "${tokens[pos].value}" at position ${pos}`);
  }

  return ast;
}
