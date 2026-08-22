import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";

type EnvLine = { body: string; ending: string };

function splitEnvLines(content: string): EnvLine[] {
  const lines: EnvLine[] = [];
  let start = 0;
  while (start < content.length) {
    let end = start;
    while (end < content.length && content[end] !== "\r" && content[end] !== "\n") end++;
    let ending = "";
    if (end < content.length) {
      ending = content[end];
      if (content[end] === "\r" && content[end + 1] === "\n") ending = "\r\n";
      end += ending.length;
    }
    lines.push({ body: content.slice(start, end - ending.length), ending });
    start = end;
  }
  return lines;
}

function activeKeyPrefix(line: string): string | undefined {
  return line.match(/^[\t ]*(?:export[\t ]+)?CONTFU_KEY[\t ]*=[\t ]*/)?.[0];
}

function newlineFor(content: string): string {
  return content.match(/\r\n|\r|\n/)?.[0] ?? "\n";
}

function assignmentValue(body: string, prefix: string): string {
  const remainder = body.slice(prefix.length);
  if (remainder.startsWith('"') || remainder.startsWith("'")) {
    const quote = remainder[0];
    let escaped = false;
    for (let index = 1; index < remainder.length; index++) {
      const character = remainder[index];
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        return remainder.slice(1, index);
      }
    }
  }

  const comment = remainder.search(/[\t ]+#/);
  return (comment < 0 ? remainder : remainder.slice(0, comment)).trim();
}

function rewriteAssignment(body: string, prefix: string, key: string): string {
  const remainder = body.slice(prefix.length);
  if (remainder.startsWith('"') || remainder.startsWith("'")) {
    const quote = remainder[0];
    let escaped = false;
    for (let index = 1; index < remainder.length; index++) {
      const character = remainder[index];
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        return `${prefix}${quote}${key}${remainder.slice(index)}`;
      }
    }
  }

  const comment = remainder.search(/[\t ]+#/);
  const value = comment < 0 ? remainder : remainder.slice(0, comment);
  const suffix = comment < 0 ? "" : remainder.slice(comment);
  const trailingWhitespace = value.match(/[\t ]*$/)?.[0] ?? "";
  return `${prefix}${key}${trailingWhitespace}${suffix}`;
}

export function getAppKey(): string | undefined {
  if (process.env.CONTFU_KEY) return process.env.CONTFU_KEY;
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return undefined;
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const { body } of splitEnvLines(content)) {
      const prefix = activeKeyPrefix(body);
      if (prefix) {
        const value = assignmentValue(body, prefix);
        if (value) return value;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function writeEnvKey(envPath: string, key: string): void {
  const resolved = resolve(envPath);
  const destinationDirectory = dirname(resolved);
  let content = "";
  let mode = 0o600;
  let destinationExists = false;

  try {
    const destination = lstatSync(resolved);
    destinationExists = true;
    if (destination.isSymbolicLink()) {
      throw new Error(`Refusing to replace symbolic-link env file: ${envPath}`);
    }
    mode = statSync(resolved).mode & 0o7777;
    content = readFileSync(resolved, "utf-8");
  } catch (error) {
    if (destinationExists || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const lines = splitEnvLines(content);
  let found = false;
  const rewritten: EnvLine[] = [];
  for (const { body, ending } of lines) {
    const prefix = activeKeyPrefix(body);
    if (!prefix) {
      rewritten.push({ body, ending });
    } else if (!found) {
      found = true;
      // Only the first active assignment is retained; its location and formatting stay intact.
      rewritten.push({ body: rewriteAssignment(body, prefix, key), ending });
    }
  }

  let transformed = rewritten.map(({ body, ending }) => body + ending).join("");
  if (!found) {
    const newline = newlineFor(content);
    if (content.length > 0 && !content.endsWith("\n") && !content.endsWith("\r"))
      transformed += newline;
    transformed += `CONTFU_KEY=${key}`;
    if (content.endsWith("\n") || content.endsWith("\r")) transformed += newline;
  }

  mkdirSync(destinationDirectory, { recursive: true });
  const temporaryPath = join(destinationDirectory, `.contfu-env-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporaryPath, transformed, {
      encoding: "utf-8",
      mode: 0o600,
      flag: "wx",
    });
    chmodSync(temporaryPath, mode);
    renameSync(temporaryPath, resolved);
  } finally {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // The temporary file was renamed or never created.
    }
  }
  console.log(`✓ CONTFU_KEY written to ${envPath}`);
}

/** Return the repository-relative path that should be placed in .gitignore. */
export function getRepositoryRelativeEnvPath(envPath: string): string | undefined {
  const root = resolve(process.cwd());
  const resolved = resolve(root, envPath);

  // Resolve the nearest existing ancestor too: an in-repository symlink may
  // point outside the repository even when its lexical path looks contained.
  let existingPath = resolved;
  while (!existsSync(existingPath)) {
    const parent = dirname(existingPath);
    if (parent === existingPath) break;
    existingPath = parent;
  }
  let realRoot: string;
  let realExistingPath: string;
  try {
    realRoot = realpathSync(root);
    realExistingPath = realpathSync(existingPath);
  } catch {
    return undefined;
  }
  const realResolved = resolve(realExistingPath, relative(existingPath, resolved));
  const repositoryRelative = relative(realRoot, realResolved);

  if (
    !repositoryRelative ||
    repositoryRelative === ".." ||
    repositoryRelative.startsWith(`..${sep}`)
  ) {
    return undefined;
  }

  return repositoryRelative.split("\\").join("/");
}

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globRegex(pattern: string): RegExp | undefined {
  let source = "";
  try {
    for (let index = 0; index < pattern.length; index += 1) {
      const character = pattern[index];
      if (character === "*") {
        if (pattern[index + 1] === "*") {
          index += 1;
          if (pattern[index + 1] === "/") {
            source += "(?:.*/)?";
            index += 1;
          } else source += ".*";
        } else source += "[^/]*";
      } else if (character === "?") source += "[^/]";
      else if (character === "[") {
        const end = pattern.indexOf("]", index + 1);
        if (end === -1) source += "\\[";
        else {
          const contents = pattern.slice(index + 1, end);
          source += `[${contents.startsWith("!") ? "^" : ""}${contents.replace(/^!/, "")}]`;
          index = end;
        }
      } else source += escapeRegex(character);
    }
    return new RegExp(`^${source}$`);
  } catch {
    return undefined;
  }
}

function globMatches(pattern: string, value: string): boolean {
  return globRegex(pattern)?.test(value) ?? false;
}

function ignorePatternMatches(pattern: string, repositoryPath: string): boolean {
  const directoryPattern = pattern.endsWith("/");
  const withoutLeadingSlash = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  const normalizedPattern = directoryPattern
    ? withoutLeadingSlash.slice(0, -1)
    : withoutLeadingSlash;
  const anchored = pattern.startsWith("/");
  const hasSlash = normalizedPattern.includes("/");

  if (directoryPattern) {
    const pathParts = repositoryPath.split("/");
    const possibleDirectories = pathParts
      .slice(0, -1)
      .map((_, index) => pathParts.slice(0, index + 1).join("/"));
    if (hasSlash || anchored) {
      return possibleDirectories.some((candidate) => globMatches(normalizedPattern, candidate));
    }
    return possibleDirectories.some((candidate) =>
      candidate.split("/").some((part) => globMatches(normalizedPattern, part)),
    );
  }

  if (hasSlash || anchored) return globMatches(normalizedPattern, repositoryPath);
  return repositoryPath.split("/").some((part) => globMatches(normalizedPattern, part));
}

function gitignoreCovers(content: string, repositoryPath: string): boolean {
  let ignored = false;
  for (const rawLine of content.split(/\r?\n/)) {
    // Leading spaces are significant in gitignore patterns.
    const line = rawLine.replace(/[ \t]+$/, "");
    if (!line || /^\s+$/.test(line) || line.startsWith("#")) continue;
    const negated = line.startsWith("!");
    const pattern = negated ? line.slice(1) : line;
    if (pattern && ignorePatternMatches(pattern, repositoryPath)) ignored = !negated;
  }
  return ignored;
}

/** Ensure the selected env file, rather than always .env, is ignored. */
export function ensureGitignore(envPath: string): void {
  const repositoryPath = getRepositoryRelativeEnvPath(envPath);
  if (!repositoryPath) {
    console.warn(`⚠ Skipped .gitignore update: env file ${envPath} is outside the repository.`);
    return;
  }

  const gitignorePath = join(process.cwd(), ".gitignore");
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
  try {
    execFileSync("git", ["check-ignore", "--no-index", "--quiet", "--", repositoryPath], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    return;
  } catch (error) {
    // Exit status 1 means Git successfully determined that the path is not
    // ignored. Only fall back for unavailable Git or a non-repository cwd.
    if ((error as { status?: number }).status === 1) {
      // Continue to the append below.
    } else if (gitignoreCovers(content, repositoryPath)) return;
  }

  const prefix =
    content.length > 0 && !content.endsWith("\n") && !content.endsWith("\r") ? "\n" : "";
  appendFileSync(gitignorePath, `${prefix}${repositoryPath}\n`, "utf-8");
  console.log(`✓ Added ${repositoryPath} to .gitignore`);
}
