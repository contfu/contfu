import { describe, expect, mock, test } from "bun:test";
import { IncidentResolutionMode, IncidentType, type ApiIncident } from "@contfu/svc-api";
import { formatIncidentAge, printIncidentList } from "./incidents";

const incident: ApiIncident = {
  id: "inc_123",
  flowId: "flow_123",
  sourceCollectionId: "col_source",
  sourceCollectionName: "Articles",
  sourceIntegrationId: "int_1",
  sourceIntegrationName: "CMS",
  targetCollectionId: "col_target",
  targetCollectionName: "Website",
  type: IncidentType.ItemValidationError,
  typeName: "item_validation_error",
  resolutionMode: IncidentResolutionMode.Dismissible,
  message: "Validation failed",
  problem: "The title is not a string.",
  suggestedAction: "Fix the title and retry.",
  affectedCount: 2,
  resolved: false,
  createdAt: "2026-06-20T10:00:00.000Z",
  resolvedAt: null,
};

describe("incident CLI presentation", () => {
  test("formats concise ages", () => {
    const now = new Date("2026-06-22T12:00:00.000Z").getTime();
    expect(formatIncidentAge(incident.createdAt, now)).toBe("2d");
  });

  test("prints actionable human output", () => {
    const log = mock(() => {});
    const original = console.log;
    console.log = log;
    try {
      printIncidentList([incident], new Date("2026-06-20T12:00:00.000Z").getTime());
    } finally {
      console.log = original;
    }

    const output = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("item_validation_error  Articles → Website");
    expect(output).toContain("problem: The title is not a string.");
    expect(output).toContain("action: Fix the title and retry.");
    expect(output).toContain("affected: 2  age: 2h");
    expect(output).toContain("contfu incidents dismiss inc_123");
  });
});
