import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function lintFixture(relativeFile: string, source: string) {
  const root = mkdtempSync(join(tmpdir(), "contfu-vsa-"));
  roots.push(root);
  const file = join(root, relativeFile);
  mkdirSync(resolve(file, ".."), { recursive: true });
  writeFileSync(file, source);
  const config = join(root, ".oxlintrc.json");
  writeFileSync(
    config,
    JSON.stringify({
      rules: {
        "contfu/no-cross-slice-imports": "error",
        "contfu/one-feature-export-per-module": "error",
      },
      jsPlugins: [resolve("scripts/oxlint/contfu/index.cjs")],
    }),
  );
  return Bun.spawnSync(["bunx", "oxlint", "--config", config, file], {
    cwd: resolve("."),
    env: process.env,
  });
}

describe("vertical slice Oxlint rules", () => {
  it("rejects directory and nested imports into sibling slices", () => {
    const direct = lintFixture(
      "packages/service/backend/src/features/orders/createOrder.ts",
      'import { reserve } from "../inventory";\nexport const createOrder = () => reserve();\n',
    );
    expect(direct.exitCode).toBe(1);
    expect(direct.stdout.toString()).toContain("must not import the `inventory` slice");

    const nested = lintFixture(
      "packages/service/backend/src/features/orders/internal/createOrder.ts",
      'import { reserve } from "../../inventory/reserve";\nexport const createOrder = () => reserve();\n',
    );
    expect(nested.exitCode).toBe(1);
  });

  it("allows own-slice and architecture-layer imports", () => {
    const result = lintFixture(
      "packages/service/backend/src/features/orders/internal/createOrder.ts",
      'import { helper } from "../helper";\nimport { policy } from "../../../domain/policy";\nexport const createOrder = () => helper(policy);\n',
    );
    expect(result.exitCode).toBe(0);

    const compositionRoot = lintFixture(
      "packages/contfu/src/connect.ts",
      'import { writeItem } from "./features/items/writeItem";\nexport const connect = () => writeItem();\n',
    );
    expect(compositionRoot.exitCode).toBe(0);
  });

  it("rejects multiple callable exports but permits related types", () => {
    const invalid = lintFixture(
      "packages/contfu/src/features/items/writeItem.ts",
      "export type Input = { id: number };\nexport const writeItem = (input: Input) => input;\nexport function deleteItem() {}\n",
    );
    expect(invalid.exitCode).toBe(1);
    expect(invalid.stdout.toString()).toContain("may export only one callable feature");

    const valid = lintFixture(
      "packages/contfu/src/features/items/writeItem.ts",
      "export type Input = { id: number };\nexport const writeItem = (input: Input) => input;\n",
    );
    expect(valid.exitCode).toBe(0);
  });

  it("does not constrain colocated specs", () => {
    const result = lintFixture(
      "packages/contfu/src/features/items/writeItem.spec.ts",
      "export const first = () => 1;\nexport const second = () => 2;\n",
    );
    expect(result.exitCode).toBe(0);
  });
});
