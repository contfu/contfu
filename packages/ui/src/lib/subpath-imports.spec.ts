import { describe, expect, test } from "bun:test";
import { cn } from "#lib/utils";
import { readFileSync } from "node:fs";

describe("application subpath imports", () => {
  test("resolves extensionless library modules", async () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect((await import("#lib/utils")).cn).toBe(cn);
  });

  test("declares library root and wildcard mappings without legacy aliases", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(pkg.imports).toEqual({ "#lib": "./src/lib", "#lib/*": "./src/lib/*" });
  });
});
