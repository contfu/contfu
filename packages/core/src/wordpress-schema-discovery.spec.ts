import { describe, expect, it } from "bun:test";
import {
  wordPressSchemaDiscovery,
  wordPressSchemaDiscoveryNote,
} from "./wordpress-schema-discovery";

describe("WordPress passive schema evidence", () => {
  it("shows the capped best-effort note and clears it for uncapped evidence", () => {
    const evidence = { sampleCapped: true, sampleOnlyFieldCount: 2, declaredFields: ["status"] };
    const options = { wordPressSchemaDiscovery: evidence };
    expect(wordPressSchemaDiscovery(options)).toEqual(evidence);
    expect(wordPressSchemaDiscoveryNote(options)).toContain("2 sample-only fields are best-effort");
    expect(
      wordPressSchemaDiscoveryNote({
        wordPressSchemaDiscovery: { ...evidence, sampleCapped: false },
      }),
    ).toBeUndefined();
  });

  it("does not mistake missing or malformed options for completeness evidence", () => {
    for (const options of [
      undefined,
      null,
      {},
      { wordPressSchemaDiscovery: true },
      {
        wordPressSchemaDiscovery: {
          sampleCapped: true,
          sampleOnlyFieldCount: -1,
          declaredFields: [],
        },
      },
    ]) {
      expect(wordPressSchemaDiscovery(options)).toBeUndefined();
      expect(wordPressSchemaDiscoveryNote(options)).toBeUndefined();
    }
  });
});
