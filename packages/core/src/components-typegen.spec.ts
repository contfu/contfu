import { describe, expect, it } from "bun:test";
import { PropertyType, generateApplicationIntegrationTypes } from "./schemas";

describe("component block type generation", () => {
  it("collapses equal component prop schemas and unions differing schemas", () => {
    const out = generateApplicationIntegrationTypes([
      {
        name: "pages",
        displayName: "Pages",
        schema: { body: [PropertyType.BLOCK, ["hero"]] },
        components: [
          { name: "hero", props: { title: PropertyType.STRING } },
          { name: "hero", props: { title: PropertyType.STRING } },
          { name: "hero", props: { image: PropertyType.FILE } },
        ],
      },
    ]);

    expect(out).toContain(
      'export type HeroComponent = ["hero", { title: string } | { image: string }, BuiltInBlock[]];',
    );
    expect(out).toContain("body: (HeroComponent)[];");
  });
});
