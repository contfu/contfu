import { SYSTEM_FIELD_SET } from "../../domain/system-fields";
import { TokenType, type Token } from "./types";

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
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
      if (i < input.length) i++;
      tokens.push({ type: TokenType.String, value });
      continue;
    }

    if (i + 1 < input.length) {
      const two = input[i] + input[i + 1];
      if (two === "!=") {
        tokens.push({ type: TokenType.Neq, value: two });
        i += 2;
        continue;
      }
      if (two === ">=") {
        tokens.push({ type: TokenType.Gte, value: two });
        i += 2;
        continue;
      }
      if (two === "<=") {
        tokens.push({ type: TokenType.Lte, value: two });
        i += 2;
        continue;
      }
      if (two === "!~") {
        tokens.push({ type: TokenType.NotLike, value: two });
        i += 2;
        continue;
      }
      if (two === "?=") {
        tokens.push({ type: TokenType.ArrayContains, value: two });
        i += 2;
        continue;
      }
      if (two === "&&") {
        tokens.push({ type: TokenType.And, value: two });
        i += 2;
        continue;
      }
      if (two === "||") {
        tokens.push({ type: TokenType.Or, value: two });
        i += 2;
        continue;
      }
    }

    if (ch === "=") {
      tokens.push({ type: TokenType.Eq, value: ch });
      i++;
      continue;
    }
    if (ch === ">") {
      tokens.push({ type: TokenType.Gt, value: ch });
      i++;
      continue;
    }
    if (ch === "<") {
      tokens.push({ type: TokenType.Lt, value: ch });
      i++;
      continue;
    }
    if (ch === "~") {
      tokens.push({ type: TokenType.Like, value: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: TokenType.LParen, value: ch });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: TokenType.RParen, value: ch });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: TokenType.Comma, value: ch });
      i++;
      continue;
    }

    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let num = ch;
      i++;
      let hasDot = false;
      while (i < input.length) {
        const c = input[i];
        if (c >= "0" && c <= "9") {
          num += c;
          i++;
        } else if (c === "." && !hasDot) {
          hasDot = true;
          num += c;
          i++;
        } else {
          break;
        }
      }
      if (num === "-") {
        throw new Error(`Unexpected character: ${ch} at position ${i - 1}`);
      }
      tokens.push({ type: TokenType.Number, value: num });
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
      let ident = ch;
      i++;
      while (i < input.length && isIdentPart(input[i])) {
        ident += input[i];
        i++;
      }

      if (ident === "true" || ident === "false") {
        tokens.push({ type: TokenType.Boolean, value: ident });
      } else if (ident === "null") {
        tokens.push({ type: TokenType.Null, value: ident });
      } else {
        tokens.push({ type: TokenType.Identifier, value: ident });
      }
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
