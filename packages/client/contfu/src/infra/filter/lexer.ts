import { TokenType, type Token } from "./types";

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    // Quoted strings (single or double)
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
      if (i < input.length) i++; // skip closing quote
      tokens.push({ type: TokenType.String, value });
      continue;
    }

    // Two-char operators
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

    // Single-char operators
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

    // Numbers (including negative)
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
      // If it's just a minus sign, treat as error
      if (num === "-") {
        throw new Error(`Unexpected character: ${ch} at position ${i - 1}`);
      }
      tokens.push({ type: TokenType.Number, value: num });
      continue;
    }

    // Identifiers (including dot-notation like props.category)
    if (isIdentStart(ch)) {
      let ident = ch;
      i++;
      while (i < input.length && isIdentPart(input[i])) {
        ident += input[i];
        i++;
      }

      // Check for keywords
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

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= "0" && ch <= "9") || ch === ".";
}
