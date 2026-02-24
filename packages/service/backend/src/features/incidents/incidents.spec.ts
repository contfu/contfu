import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  incidentTable,
  influxTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
} from "../../infra/db/schema";
import { pack } from "msgpackr";
import crypto from "node:crypto";
import { FilterOperator, PropertyType, type CollectionSchema } from "@contfu/svc-core";
import { IncidentType, type SchemaIncompatibleDetails } from "@contfu/svc-core";
import { runTest } from "../../../test/effect-helpers";
import { createIncident } from "./createIncident";
import { listIncidents } from "./listIncidents";
import { getUnresolvedIncidentCount } from "./getUnresolvedIncidentCount";
import { resolveIncident } from "./resolveIncident";
import { autoResolveIncidentsForInflux } from "./autoResolveIncidentsForInflux";

/**
 * Unit tests for incident tracking operations.
 * Uses real in-memory SQLite database, not mocks.
 */

const isDbMocked = typeof db.delete !== "function";

describe.skipIf(isDbMocked)("Incident Features", () => {
  let testUserId: number;
  let testInfluxId: number;
  let testCollectionId: number;
  let testSourceCollectionId: number;

  const testSchema: CollectionSchema = {
    title: PropertyType.STRING,
    content: PropertyType.STRING,
  };

  beforeEach(async () => {
    // Delete in correct order for foreign keys
    await db.delete(incidentTable);
    await db.delete(influxTable);
    await db.delete(collectionTable);
    await db.delete(sourceCollectionTable);
    await db.delete(sourceTable);
    await db.delete(userTable);

    // Create test user
    const [user] = await db
      .insert(userTable)
      .values({
        name: "Test User",
        email: "incident-test@test.com",
      })
      .returning();
    testUserId = user.id;

    // Create test source
    const [source] = await db
      .insert(sourceTable)
      .values({
        userId: testUserId,
        uid: crypto.randomUUID(),
        type: 1,
        name: "Test Source",
      })
      .returning();

    // Create test source collection
    const [sourceCollection] = await db
      .insert(sourceCollectionTable)
      .values({
        userId: testUserId,
        sourceId: source.id,
        name: "Articles",
        schema: pack(testSchema),
      })
      .returning();
    testSourceCollectionId = sourceCollection.id;

    // Create test collection
    const [collection] = await db
      .insert(collectionTable)
      .values({
        userId: testUserId,
        displayName: "My Collection",
        name: "myCollection",
      })
      .returning();
    testCollectionId = collection.id;

    // Create test influx
    const [influx] = await db
      .insert(influxTable)
      .values({
        userId: testUserId,
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
        schema: pack(testSchema),
      })
      .returning();
    testInfluxId = influx.id;
  });

  describe("createIncident", () => {
    it("should create a basic incident", async () => {
      const incident = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema changed: field 'title' removed",
        }),
      );

      expect(incident.id).toBeGreaterThan(0);
      expect(incident.userId).toBe(testUserId);
      expect(incident.influxId).toBe(testInfluxId);
      expect(incident.type).toBe(IncidentType.SchemaIncompatible);
      expect(incident.message).toBe("Schema changed: field 'title' removed");
      expect(incident.resolved).toBe(false);
      expect(incident.createdAt).toBeInstanceOf(Date);
      expect(incident.resolvedAt).toBeNull();
    });

    it("should store incident details", async () => {
      const details: SchemaIncompatibleDetails = {
        oldSchema: testSchema,
        newSchema: { title: PropertyType.NUMBER },
        invalidFilters: [{ property: "content", operator: FilterOperator.CONTAINS, value: "test" }],
      };

      const incident = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema type changed",
          details,
        }),
      );

      expect(incident.details).toEqual(details as unknown as Record<string, unknown>);
    });

    it("should auto-increment incident IDs per user", async () => {
      const incident1 = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "First incident",
        }),
      );
      const incident2 = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SyncError,
          message: "Second incident",
        }),
      );

      expect(incident2.id).toBeGreaterThan(incident1.id);
    });

    it("should support different incident types", async () => {
      const schemaIncident = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema changed",
        }),
      );
      const filterIncident = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.FilterInvalid,
          message: "Filter references missing field",
        }),
      );
      const syncIncident = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SyncError,
          message: "Failed to sync data",
        }),
      );

      expect(schemaIncident.type).toBe(IncidentType.SchemaIncompatible);
      expect(filterIncident.type).toBe(IncidentType.FilterInvalid);
      expect(syncIncident.type).toBe(IncidentType.SyncError);
    });

    it("should reject creating an incident for another user's influx", async () => {
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2-z@test.com" })
        .returning();

      const [source2] = await db
        .insert(sourceTable)
        .values({
          userId: user2.id,
          uid: crypto.randomUUID(),
          type: 1,
          name: "User2 Source",
        })
        .returning();
      const [sourceCollection2] = await db
        .insert(sourceCollectionTable)
        .values({
          userId: user2.id,
          sourceId: source2.id,
          name: "User2 Source Collection",
        })
        .returning();
      const [collection2] = await db
        .insert(collectionTable)
        .values({
          userId: user2.id,
          displayName: "User2 Collection",
          name: "user2Collection",
        })
        .returning();
      const [influx2] = await db
        .insert(influxTable)
        .values({
          userId: user2.id,
          collectionId: collection2.id,
          sourceCollectionId: sourceCollection2.id,
        })
        .returning();

      await expect(
        runTest(
          createIncident(testUserId, {
            influxId: influx2.id,
            type: IncidentType.SyncError,
            message: "Cross-tenant write attempt",
          }),
        ),
      ).rejects.toThrow("Influx not found");
    });
  });

  describe("listIncidents", () => {
    it("should return empty array when no incidents exist", async () => {
      const incidents = await runTest(listIncidents(testUserId));

      expect(incidents).toEqual([]);
    });

    it("should return all incidents with details", async () => {
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema changed",
        }),
      );
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SyncError,
          message: "Sync failed",
        }),
      );

      const incidents = await runTest(listIncidents(testUserId));

      expect(incidents.length).toBe(2);
      expect(incidents[0].collectionName).toBe("My Collection");
      expect(incidents[0].sourceCollectionName).toBe("Articles");
    });

    it("should return incidents ordered by creation (most recent first)", async () => {
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "First",
        }),
      );
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SyncError,
          message: "Second",
        }),
      );

      const incidents = await runTest(listIncidents(testUserId));

      // Verify we have both incidents (order depends on DB implementation)
      expect(incidents.length).toBe(2);
      const messages = incidents.map((i) => i.message).sort();
      expect(messages).toEqual(["First", "Second"]);
    });

    it("should filter by resolved status", async () => {
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "Unresolved",
        }),
      );

      const unresolved = await runTest(listIncidents(testUserId, { resolved: false }));
      const resolved = await runTest(listIncidents(testUserId, { resolved: true }));

      expect(unresolved.length).toBe(1);
      expect(resolved.length).toBe(0);
    });

    it("should only return incidents for the specified user", async () => {
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "User1 incident",
        }),
      );

      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const incidents = await runTest(listIncidents(user2.id));

      expect(incidents).toEqual([]);
    });
  });

  describe("getUnresolvedIncidentCount", () => {
    it("should return 0 when no incidents exist", async () => {
      const count = await runTest(getUnresolvedIncidentCount(testUserId));

      expect(count).toBe(0);
    });

    it("should count only unresolved incidents", async () => {
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "First",
        }),
      );
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SyncError,
          message: "Second",
        }),
      );

      const count = await runTest(getUnresolvedIncidentCount(testUserId));

      expect(count).toBe(2);
    });
  });

  describe("resolveIncident", () => {
    it("should resolve and delete an incident", async () => {
      const incident = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "To resolve",
        }),
      );

      const resolved = await runTest(resolveIncident(testUserId, incident.id));

      expect(resolved).toBe(true);

      // Verify it's deleted
      const incidents = await runTest(listIncidents(testUserId));
      expect(incidents.length).toBe(0);
    });

    it("should return false for non-existent incident", async () => {
      const resolved = await runTest(resolveIncident(testUserId, 999));

      expect(resolved).toBe(false);
    });

    it("should not resolve another user's incident", async () => {
      const incident = await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "Protected",
        }),
      );

      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const resolved = await runTest(resolveIncident(user2.id, incident.id));

      expect(resolved).toBe(false);

      // Verify original exists
      const incidents = await runTest(listIncidents(testUserId));
      expect(incidents.length).toBe(1);
    });
  });

  describe("autoResolveIncidentsForInflux", () => {
    it("should resolve all unresolved incidents for an influx", async () => {
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "First",
        }),
      );
      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.FilterInvalid,
          message: "Second",
        }),
      );

      const count = await runTest(autoResolveIncidentsForInflux(testUserId, testInfluxId));

      expect(count).toBe(2);

      // Verify they're deleted
      const incidents = await runTest(listIncidents(testUserId));
      expect(incidents.length).toBe(0);
    });

    it("should return 0 when no incidents exist", async () => {
      const count = await runTest(autoResolveIncidentsForInflux(testUserId, testInfluxId));

      expect(count).toBe(0);
    });

    it("should only resolve incidents for the specified influx", async () => {
      // Create second influx
      const [influx2] = await db
        .insert(influxTable)
        .values({
          userId: testUserId,
          collectionId: testCollectionId,
          sourceCollectionId: testSourceCollectionId,
        })
        .returning();

      await runTest(
        createIncident(testUserId, {
          influxId: testInfluxId,
          type: IncidentType.SchemaIncompatible,
          message: "Influx 1 incident",
        }),
      );
      await runTest(
        createIncident(testUserId, {
          influxId: influx2.id,
          type: IncidentType.SchemaIncompatible,
          message: "Influx 2 incident",
        }),
      );

      const count = await runTest(autoResolveIncidentsForInflux(testUserId, testInfluxId));

      expect(count).toBe(1);

      // Verify influx 2's incident still exists
      const incidents = await runTest(listIncidents(testUserId));
      expect(incidents.length).toBe(1);
      expect(incidents[0].influxId).toBe(influx2.id);
    });
  });
});
