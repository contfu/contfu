import { SYSTEM_FIELD_SET } from "@contfu/core";
import { TokenType, type Token } from "./types";

/** A scanned token together with the index to resume lexing from. */
interface Scan {
  token: Token;
  nextIndex: number;
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

/** Matched before single-character operators so `>=` never lexes as `>` `=`. */
const TWO_CHAR_OPERATORS: Record<string, TokenType> = {
  "!=": TokenType.Neq,
  ">=": TokenType.Gte,
  "<=": TokenType.Lte,
  "!~": TokenType.NotLike,
  "?=": TokenType.ArrayContains,
  "&&": TokenType.And,
  "||": TokenType.Or,
};

const ONE_CHAR_OPERATORS: Record<string, TokenType> = {
  "=": TokenType.Eq,
  ">": TokenType.Gt,
  "<": TokenType.Lt,
  "~": TokenType.Like,
  "(": TokenType.LParen,
  ")": TokenType.RParen,
  ",": TokenType.Comma,
};

/** Identifiers that are reserved literals rather than field names. */
const KEYWORD_TOKENS: Record<string, TokenType> = {
  true: TokenType.Boolean,
  false: TokenType.Boolean,
  null: TokenType.Null,
};

/** Read a quoted string, honouring backslash escapes. */
function readString(input: string, start: number): Scan {
  const quote = input[start];
  let i = start + 1;
  let value = "";

  while (i < input.length && input[i] !== quote) {
    if (input[i] === "\\") {
      i++;
      if (i < input.length) value += input[i];
    } else {
      value += input[i];
    }
    i++;
  }

  // An unterminated string ends at input end rather than failing.
  return { token: { type: TokenType.String, value }, nextIndex: i < input.length ? i + 1 : i };
}

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= "0" && ch <= "9";

/** Read an optionally negative decimal number. */
function readNumber(input: string, start: number): Scan {
  let i = start + 1;
  let value = input[start];
  let hasDot = false;

  while (i < input.length) {
    const ch = input[i];
    if (isDigit(ch)) {
      value += ch;
    } else if (ch === "." && !hasDot) {
      hasDot = true;
      value += ch;
    } else {
      break;
    }
    i++;
  }

  // A bare `-` is a stray operator, not a number.
  if (value === "-") throw new Error(`Unexpected character: - at position ${start}`);

  return { token: { type: TokenType.Number, value }, nextIndex: i };
}

/** Read an identifier, promoting reserved words to literal tokens. */
function readIdentifier(input: string, start: number): Scan {
  let i = start + 1;
  let value = input[start];

  while (i < input.length && isIdentPart(input[i])) {
    value += input[i];
    i++;
  }

  return { token: { type: KEYWORD_TOKENS[value] ?? TokenType.Identifier, value }, nextIndex: i };
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (WHITESPACE.has(ch)) {
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const { token, nextIndex } = readString(input, i);
      tokens.push(token);
      i = nextIndex;
      continue;
    }

    const twoCharType = TWO_CHAR_OPERATORS[input.slice(i, i + 2)];
    if (twoCharType !== undefined) {
      tokens.push({ type: twoCharType, value: input.slice(i, i + 2) });
      i += 2;
      continue;
    }

    const oneCharType = ONE_CHAR_OPERATORS[ch];
    if (oneCharType !== undefined) {
      tokens.push({ type: oneCharType, value: ch });
      i++;
      continue;
    }

    if (ch === "-" || isDigit(ch)) {
      const { token, nextIndex } = readNumber(input, i);
      tokens.push(token);
      i = nextIndex;
      continue;
    }

    if (ch === "$") {
      const systemField = readSystemField(input, i);
      if (systemField) {
        tokens.push({ type: TokenType.SystemField, value: systemField.value });
        i = systemField.nextIndex;
        continue;
      }
    }

    if (isIdentStart(ch)) {
      const { token, nextIndex } = readIdentifier(input, i);
      tokens.push(token);
      i = nextIndex;
      continue;
    }

    throw new Error(`Unexpected character: ${ch} at position ${i}`);
  }

  return tokens;
}

function readSystemField(
  input: string,
  start: number,
): { value: string; nextIndex: number } | null {
  let i = start + 1;
  if (i >= input.length || !isIdentStart(input[i])) return null;

  let ident = "$";
  while (i < input.length && isIdentPart(input[i])) {
    ident += input[i];
    i++;
  }

  if (!SYSTEM_FIELD_SET.has(ident)) {
    throw new Error(`Unknown system field: ${ident}`);
  }

  return { value: ident, nextIndex: i };
}

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= "0" && ch <= "9");
}
