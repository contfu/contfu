import { describe, expect, test } from "bun:test";
import { tokenize } from "./lexer";
import { parse } from "./parser";

describe("parse", () => {
  test("parses simple comparison", () => {
    const ast = parse(tokenize('$collection = "articles"'));
    expect(ast).toEqual({
      kind: "comparison",
      field: "$collection",
      op: "=",
      value: "articles",
    });
  });

  test("parses number value", () => {
    const ast = parse(tokenize("$changedAt >= 100"));
    expect(ast).toEqual({
      kind: "comparison",
      field: "$changedAt",
      op: ">=",
      value: 100,
    });
  });

  test("parses boolean value", () => {
    const ast = parse(tokenize("featured = true"));
    expect(ast).toEqual({
      kind: "comparison",
      field: "featured",
      op: "=",
      value: true,
    });
  });

  test("parses null value", () => {
    const ast = parse(tokenize("$ref = null"));
    expect(ast).toEqual({
      kind: "comparison",
      field: "$ref",
      op: "=",
      value: null,
    });
  });

  test("parses AND expression", () => {
    const ast = parse(tokenize('$collection = "articles" && $changedAt > 100'));
    expect(ast).toEqual({
      kind: "and",
      left: { kind: "comparison", field: "$collection", op: "=", value: "articles" },
      right: { kind: "comparison", field: "$changedAt", op: ">", value: 100 },
    });
  });

  test("parses OR expression", () => {
    const ast = parse(tokenize('$collection = "articles" || $collection = "guides"'));
    expect(ast).toEqual({
      kind: "or",
      left: { kind: "comparison", field: "$collection", op: "=", value: "articles" },
      right: { kind: "comparison", field: "$collection", op: "=", value: "guides" },
    });
  });

  test("AND binds tighter than OR", () => {
    const ast = parse(tokenize("a = 1 || b = 2 && c = 3"));
    expect(ast).toEqual({
      kind: "or",
      left: { kind: "comparison", field: "a", op: "=", value: 1 },
      right: {
        kind: "and",
        left: { kind: "comparison", field: "b", op: "=", value: 2 },
        right: { kind: "comparison", field: "c", op: "=", value: 3 },
      },
    });
  });

  test("parses parenthesized grouping", () => {
    const ast = parse(tokenize("(a = 1 || b = 2) && c = 3"));
    expect(ast).toEqual({
      kind: "and",
      left: {
        kind: "group",
        expr: {
          kind: "or",
          left: { kind: "comparison", field: "a", op: "=", value: 1 },
          right: { kind: "comparison", field: "b", op: "=", value: 2 },
        },
      },
      right: { kind: "comparison", field: "c", op: "=", value: 3 },
    });
  });

  test("parses function call", () => {
    const ast = parse(tokenize("depth($ref) = 2"));
    expect(ast).toEqual({
      kind: "function",
      name: "depth",
      args: ["$ref"],
      op: "=",
      value: 2,
    });
  });

  test("parses like operator", () => {
    const ast = parse(tokenize('title ~ "hello"'));
    expect(ast).toEqual({
      kind: "comparison",
      field: "title",
      op: "~",
      value: "hello",
    });
  });

  test("parses array contains operator", () => {
    const ast = parse(tokenize('tags ?= "news"'));
    expect(ast).toEqual({
      kind: "comparison",
      field: "tags",
      op: "?=",
      value: "news",
    });
  });

  test("throws on missing operator", () => {
    expect(() => parse(tokenize("collection"))).toThrow();
  });

  test("throws on missing value", () => {
    expect(() => parse(tokenize("collection ="))).toThrow();
  });

  test("throws on trailing tokens", () => {
    expect(() => parse(tokenize('a = 1 "extra"'))).toThrow();
  });
});
