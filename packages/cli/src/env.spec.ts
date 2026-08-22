import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ensureGitignore, getAppKey, getRepositoryRelativeEnvPath, writeEnvKey } from "./env";

let cwd: string;
let previousCwd: string;

beforeEach(() => {
  previousCwd = process.cwd();
  cwd = mkdtempSync(join(tmpdir(), "contfu-env-"));
  process.chdir(cwd);
  delete process.env.CONTFU_KEY;
});

afterEach(() => {
  delete process.env.CONTFU_KEY;
  process.chdir(previousCwd);
  rmSync(cwd, { recursive: true, force: true });
});

describe("env key files", () => {
  test("replaces a key on repeated writes and leaves one active assignment", () => {
    const path = join(cwd, ".env");
    writeEnvKey(path, "first");
    writeEnvKey(path, "second");

    expect(readFileSync(path, "utf8")).toBe("CONTFU_KEY=second");
    expect(getAppKey()).toBe("second");
  });

  test("deduplicates active assignments while preserving unrelated content", () => {
    const path = join(cwd, ".env");
    writeFileSync(
      path,
      "# keep\nexport CONTFU_KEY = old  \nOTHER=value\nCONTFU_KEY=new\n# CONTFU_KEY=comment\n",
    );

    writeEnvKey(path, "latest");

    expect(readFileSync(path, "utf8")).toBe(
      "# keep\nexport CONTFU_KEY = latest  \nOTHER=value\n# CONTFU_KEY=comment\n",
    );
    expect(getAppKey()).toBe("latest");
  });

  test("preserves inline comments for quoted and unquoted assignments", () => {
    const path = join(cwd, ".env");
    writeFileSync(path, "CONTFU_KEY=old # deployment note\n");
    writeEnvKey(path, "latest");
    expect(readFileSync(path, "utf8")).toBe("CONTFU_KEY=latest # deployment note\n");

    writeFileSync(path, 'export CONTFU_KEY = "quoted old" # quoted note\n');
    writeEnvKey(path, "quoted latest");
    expect(readFileSync(path, "utf8")).toBe('export CONTFU_KEY = "quoted latest" # quoted note\n');
    expect(getAppKey()).toBe("quoted latest");
  });

  test("preserves CRLF and missing trailing newline", () => {
    const path = join(cwd, ".env");
    writeFileSync(path, "OTHER=value\r\nCONTFU_KEY=old", "utf8");

    writeEnvKey(path, "new");

    expect(readFileSync(path, "utf8")).toBe("OTHER=value\r\nCONTFU_KEY=new");
    expect(getAppKey()).toBe("new");
  });

  test("reads optional export syntax and ignores commented assignments", () => {
    writeFileSync(join(cwd, ".env"), "# CONTFU_KEY=wrong\r\n export CONTFU_KEY = right \r\n");

    expect(getAppKey()).toBe("right");
  });

  test("creates secret files with restrictive permissions and preserves existing mode", () => {
    const newPath = join(cwd, "new.env");
    writeEnvKey(newPath, "secret");
    expect(statSync(newPath).mode & 0o777).toBe(0o600);

    const existingPath = join(cwd, "existing.env");
    writeFileSync(existingPath, "CONTFU_KEY=old\n");
    chmodSync(existingPath, 0o640);
    writeEnvKey(existingPath, "new");
    expect(statSync(existingPath).mode & 0o777).toBe(0o640);
  });
});

describe("getRepositoryRelativeEnvPath", () => {
  test("normalizes relative and absolute paths inside the repository", () => {
    expect(getRepositoryRelativeEnvPath(".env")).toBe(".env");
    expect(getRepositoryRelativeEnvPath("config/.env.local")).toBe("config/.env.local");
    expect(getRepositoryRelativeEnvPath(resolve(cwd, "config/.env.local"))).toBe(
      "config/.env.local",
    );
  });

  test("rejects paths outside the repository", () => {
    expect(getRepositoryRelativeEnvPath("../outside.env")).toBeUndefined();
    expect(getRepositoryRelativeEnvPath(join(tmpdir(), "outside.env"))).toBeUndefined();
  });
});

describe("ensureGitignore", () => {
  test("creates .gitignore for the default env file", () => {
    ensureGitignore(".env");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toBe(".env\n");
  });

  test("adds nested custom paths and handles missing final newline", () => {
    writeFileSync(join(cwd, ".gitignore"), "node_modules\n.env.example");
    ensureGitignore("config/.env.local");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toBe(
      "node_modules\n.env.example\nconfig/.env.local\n",
    );
  });

  test("recognizes exact entries, comments, and supported covering patterns", () => {
    writeFileSync(join(cwd, ".gitignore"), "# .env.local\n*.local\n");
    ensureGitignore("config/.env.local");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toBe("# .env.local\n*.local\n");

    writeFileSync(join(cwd, ".gitignore"), "# config/.env.local\nconfig/.env.local.backup\n");
    ensureGitignore("config/.env.local");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toContain("config/.env.local\n");
  });

  test("does not duplicate an exact entry or a covered nested path", () => {
    writeFileSync(join(cwd, ".gitignore"), ".env\nconfig/\n");
    ensureGitignore(".env");
    ensureGitignore("config/.env.local");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toBe(".env\nconfig/\n");
  });

  test("matches Git for significant leading spaces and malformed globs", () => {
    writeFileSync(join(cwd, ".gitignore"), " .env\n[z-a]\n");
    ensureGitignore(".env");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toBe(" .env\n[z-a]\n.env\n");
  });

  test("does not treat a directory-only pattern for the file itself as coverage", () => {
    writeFileSync(join(cwd, ".gitignore"), ".env/\nconfig/.env.local/\n");
    ensureGitignore(".env");
    ensureGitignore("config/.env.local");
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toBe(
      ".env/\nconfig/.env.local/\n.env\nconfig/.env.local\n",
    );
  });

  test("preserves CRLF while appending an absolute in-repository path", () => {
    writeFileSync(join(cwd, ".gitignore"), "node_modules\r\n");
    ensureGitignore(resolve(cwd, "config/.env.local"));
    expect(readFileSync(join(cwd, ".gitignore"), "utf8")).toBe(
      "node_modules\r\nconfig/.env.local\n",
    );
  });

  test("rejects symlink paths that resolve outside the repository", () => {
    const outside = mkdtempSync(join(tmpdir(), "contfu-env-outside-"));
    try {
      symlinkSync(outside, join(cwd, "linked"));
      expect(getRepositoryRelativeEnvPath("linked/.env")).toBeUndefined();
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("warns and leaves .gitignore unchanged for outside paths", () => {
    const warning = spyOn(console, "warn").mockImplementation(() => {});
    try {
      ensureGitignore("../outside.env");
      expect(existsSync(join(cwd, ".gitignore"))).toBe(false);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining("outside the repository"));
    } finally {
      warning.mockRestore();
    }
  });
});
