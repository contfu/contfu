import { describe, expect, test } from "bun:test";
import {
  getIncidentPresentation,
  IncidentResolutionActionKind,
  IncidentResolutionManualReason,
  IncidentType,
  planIncidentResolution,
  SourceUnavailableReason,
} from "./incidents";

describe("incident resolution planning", () => {
  test("keeps ambiguous incidents manual and deduplicates precise deliveries", () => {
    const plan = planIncidentResolution([
      {
        id: "1",
        type: IncidentType.SchemaIncompatible,
        message: "schema conflict",
        details: { invalidMappings: [{ source: "a", target: "b" }] },
      },
      {
        id: "2",
        type: IncidentType.SourceUnavailable,
        message: "Source item could not be resolved for target delivery",
        details: { itemId: 4, failedDeliveryId: 9 },
      },
      {
        id: "3",
        type: IncidentType.SourceUnavailable,
        message: "Source item could not be resolved for target delivery",
        details: { itemId: 5, failedDeliveryId: 9 },
      },
    ]);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      kind: IncidentResolutionActionKind.RedeliverTargetDelivery,
      incidentIds: ["2", "3"],
      operation: { failedDeliveryId: "9" },
    });
    expect(plan.manual[0].reason).toBe(IncidentResolutionManualReason.SchemaConflict);
  });

  test("binds the delivery revision and operation into executable actions", () => {
    const plan = planIncidentResolution([
      {
        id: "1",
        type: IncidentType.SourceUnavailable,
        message: "Source data is unavailable for target delivery",
        details: { itemId: 4, failedDeliveryId: 9 },
        delivery: { id: "9", changedAt: 123, deleted: false },
      },
    ]);
    expect(plan.actions[0]).toMatchObject({
      operation: { failedDeliveryId: "9", changedAt: 123, deleted: false },
    });
  });

  test("does not guess a delivery id from an item id or malformed detail", () => {
    const plan = planIncidentResolution([
      {
        id: "1",
        type: IncidentType.SourceUnavailable,
        message: "Source data is unavailable for target delivery",
        details: { itemId: 4 },
      },
      {
        id: "2",
        type: IncidentType.SourceUnavailable,
        message: "Source data is unavailable for target delivery",
        details: { itemId: 5, failedDeliveryId: "\\\\d+" },
      },
    ]);
    expect(plan.actions).toHaveLength(0);
    expect(plan.manual.map((item) => item.reason)).toEqual([
      IncidentResolutionManualReason.MissingDetails,
      IncidentResolutionManualReason.MissingDetails,
    ]);
  });
});

describe("incident presentation", () => {
  test("uses specific detail text and affected count", () => {
    expect(
      getIncidentPresentation({
        type: IncidentType.ItemValidationError,
        message: "Validation failed",
        details: {
          problem: "Property title could not be cast to a string.",
          suggestedAction: "Fix the source title, then retry.",
          totalFailed: 3,
        },
      }),
    ).toEqual({
      typeName: "item_validation_error",
      problem: "Property title could not be cast to a string.",
      suggestedAction: "Fix the source title, then retry.",
      affectedCount: 3,
    });
  });

  test("maps source-unavailable reasons and legacy messages", () => {
    expect(
      getIncidentPresentation({
        type: IncidentType.SyncError,
        message: "Source data is unavailable for target delivery",
        details: {
          itemId: 42,
          reason: SourceUnavailableReason.SourceCacheEntryExpired,
        },
      }),
    ).toMatchObject({
      typeName: "source_unavailable",
      problem: "The source item's cached data has expired.",
      suggestedAction:
        "Resync the source collection, then redeliver the affected item. This incident clears when that delivery succeeds.",
    });
  });

  test("presents legacy nested resolution items", () => {
    expect(
      getIncidentPresentation({
        type: IncidentType.SchemaIncompatible,
        message: "Flow contract is invalid",
        details: {
          invalidMappings: [
            {
              source: "headline",
              target: "title",
              suggestedAction: "Choose an existing source property.",
            },
          ],
        },
      }),
    ).toMatchObject({
      problem: 'Mapping from "headline" to "title" needs review.',
      suggestedAction: "Choose an existing source property.",
    });
  });

  test("falls back safely for malformed and legacy details", () => {
    expect(
      getIncidentPresentation({
        type: IncidentType.SyncError,
        message: "Webhook returned HTTP 500",
        details: { problem: 42, totalFailed: -1 },
      }),
    ).toMatchObject({
      typeName: "sync_error",
      problem: "Webhook returned HTTP 500",
      affectedCount: 1,
    });
  });
});
