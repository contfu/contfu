import { describe, expect, test } from "bun:test";
import { getIncidentPresentation, IncidentType, SourceUnavailableReason } from "./incidents";

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
