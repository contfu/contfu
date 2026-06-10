import { describe, expect, it } from "bun:test";
import { defineEnum, defineStringEnum, type EnumValue } from "./enums";

describe("enum helpers", () => {
  it("keeps numeric enum literal values and freezes the object", () => {
    const Status = defineEnum({ Draft: 1, Active: 2 });
    const active: EnumValue<typeof Status> = Status.Active;

    expect(active).toBe(2);
    expect(Object.isFrozen(Status)).toBe(true);
  });

  it("keeps string enum literal values for explicit external contracts", () => {
    const WebhookEvent = defineStringEnum({ ItemsFetched: "items.fetched" });
    const event: EnumValue<typeof WebhookEvent> = WebhookEvent.ItemsFetched;

    expect(event).toBe("items.fetched");
    expect(Object.isFrozen(WebhookEvent)).toBe(true);
  });
});
