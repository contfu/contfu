import { describe, expect, test } from "bun:test";
import { tokenize } from "./lexer";
import { TokenType } from "./types";

describe("tokenize", () => {
  test("tokenizes simple comparison", () => {
    const tokens = tokenize('$collection = "articles"');
    expect(tokens).toEqual([
      { type: TokenType.SystemField, value: "$collection" },
      { type: TokenType.Eq, value: "=" },
      { type: TokenType.String, value: "articles" },
    ]);
  });

  test("tokenizes property identifier", () => {
    const tokens = tokenize('category = "news"');
    expect(tokens).toEqual([
      { type: TokenType.Identifier, value: "category" },
      { type: TokenType.Eq, value: "=" },
      { type: TokenType.String, value: "news" },
    ]);
  });

  test("tokenizes numbers", () => {
    const tokens = tokenize("$changedAt >= 100");
    expect(tokens).toEqual([
      { type: TokenType.SystemField, value: "$changedAt" },
      { type: TokenType.Gte, value: ">=" },
      { type: TokenType.Number, value: "100" },
    ]);
  });

  test("tokenizes booleans and null", () => {
    const tokens = tokenize("featured = true && $ref != null");
    expect(tokens).toEqual([
      { type: TokenType.Identifier, value: "featured" },
      { type: TokenType.Eq, value: "=" },
      { type: TokenType.Boolean, value: "true" },
      { type: TokenType.And, value: "&&" },
      { type: TokenType.SystemField, value: "$ref" },
      { type: TokenType.Neq, value: "!=" },
      { type: TokenType.Null, value: "null" },
    ]);
  });

  test("tokenizes all two-char operators", () => {
    expect(tokenize("a != 1")[1]).toEqual({ type: TokenType.Neq, value: "!=" });
    expect(tokenize("a >= 1")[1]).toEqual({ type: TokenType.Gte, value: ">=" });
    expect(tokenize("a <= 1")[1]).toEqual({ type: TokenType.Lte, value: "<=" });
    expect(tokenize("a !~ 'x'")[1]).toEqual({ type: TokenType.NotLike, value: "!~" });
    expect(tokenize("a ?= 'x'")[1]).toEqual({ type: TokenType.ArrayContains, value: "?=" });
    expect(tokenize("a = 1 && b = 2")[3]).toEqual({ type: TokenType.And, value: "&&" });
    expect(tokenize("a = 1 || b = 2")[3]).toEqual({ type: TokenType.Or, value: "||" });
  });

  test("tokenizes single-char operators", () => {
    expect(tokenize("a = 1")[1]).toEqual({ type: TokenType.Eq, value: "=" });
    expect(tokenize("a > 1")[1]).toEqual({ type: TokenType.Gt, value: ">" });
    expect(tokenize("a < 1")[1]).toEqual({ type: TokenType.Lt, value: "<" });
    expect(tokenize("a ~ 'x'")[1]).toEqual({ type: TokenType.Like, value: "~" });
  });

  test("tokenizes parentheses", () => {
    const tokens = tokenize("(a = 1)");
    expect(tokens[0]).toEqual({ type: TokenType.LParen, value: "(" });
    expect(tokens[4]).toEqual({ type: TokenType.RParen, value: ")" });
  });

  test("handles escaped quotes in strings", () => {
    const tokens = tokenize("a = 'it\\'s'");
    expect(tokens[2]).toEqual({ type: TokenType.String, value: "it's" });
  });

  test("handles double-quoted strings", () => {
    const tokens = tokenize('a = "hello world"');
    expect(tokens[2]).toEqual({ type: TokenType.String, value: "hello world" });
  });

  test("tokenizes decimal numbers", () => {
    const tokens = tokenize("a = 3.14");
    expect(tokens[2]).toEqual({ type: TokenType.Number, value: "3.14" });
  });

  test("tokenizes negative numbers", () => {
    const tokens = tokenize("a = -5");
    expect(tokens[2]).toEqual({ type: TokenType.Number, value: "-5" });
  });

  test("tokenizes function call syntax", () => {
    const tokens = tokenize("depth($ref) = 2");
    expect(tokens).toEqual([
      { type: TokenType.Identifier, value: "depth" },
      { type: TokenType.LParen, value: "(" },
      { type: TokenType.SystemField, value: "$ref" },
      { type: TokenType.RParen, value: ")" },
      { type: TokenType.Eq, value: "=" },
      { type: TokenType.Number, value: "2" },
    ]);
  });

  test("tokenizes system fields", () => {
    const tokens = tokenize('$id = "abc"');
    expect(tokens[0]).toEqual({ type: TokenType.SystemField, value: "$id" });
  });

  test("throws on unexpected character", () => {
    expect(() => tokenize("a @ b")).toThrow("Unexpected character");
  });
});
