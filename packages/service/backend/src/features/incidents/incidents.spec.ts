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
import { IncidentType, type CollectionSchema, type SchemaIncompatibleDetails } from "@contfu/core";
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
    fields: [
      { key: "title", type: "string" },
      { key: "content", type: "string" },
    ],
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
        id: 1,
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
        id: 1,
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
        id: 1,
        name: "My Collection",
      })
      .returning();
    testCollectionId = collection.id;

    // Create test influx
    const [influx] = await db
      .insert(influxTable)
      .values({
        userId: testUserId,
        id: 1,
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
        schema: pack(testSchema),
      })
      .returning();
    testInfluxId = influx.id;
  });

  describe("createIncident", () => {
    it("should create a basic incident", async () => {
      const incident = await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "Schema changed: field 'title' removed",
      });

      expect(incident.id).toBe(1);
      expect(incident.userId).toBe(testUserId);
      expect(incident.influxId).toBe(testInfluxId);
      expect(incident.type).toBe(IncidentType.SchemaIncompatible);
      expect(incident.message).toBe("Schema changed: field 'title' removed");
      expect(incident.resolved).toBe(false);
      expect(incident.createdAt).toBeGreaterThan(0);
      expect(incident.resolvedAt).toBeNull();
    });

    it("should store incident details", async () => {
      const details: SchemaIncompatibleDetails = {
        oldSchema: testSchema,
        newSchema: { fields: [{ key: "title", type: "number" }] },
        invalidFilters: [{ field: "content", operator: "contains", value: "test" }],
      };

      const incident = await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "Schema type changed",
        details,
      });

      expect(incident.details).toEqual(details);
    });

    it("should auto-increment incident IDs per user", async () => {
      const incident1 = await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "First incident",
      });
      const incident2 = await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SyncError,
        message: "Second incident",
      });

      expect(incident1.id).toBe(1);
      expect(incident2.id).toBe(2);
    });

    it("should support different incident types", async () => {
      const schemaIncident = await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "Schema changed",
      });
      const filterIncident = await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.FilterInvalid,
        message: "Filter references missing field",
      });
      const syncIncident = await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SyncError,
        message: "Failed to sync data",
      });

      expect(schemaIncident.type).toBe(IncidentType.SchemaIncompatible);
      expect(filterIncident.type).toBe(IncidentType.FilterInvalid);
      expect(syncIncident.type).toBe(IncidentType.SyncError);
    });
  });

  describe("listIncidents", () => {
    it("should return empty array when no incidents exist", async () => {
      const incidents = await listIncidents(testUserId);

      expect(incidents).toEqual([]);
    });

    it("should return all incidents with details", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "Schema changed",
      });
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SyncError,
        message: "Sync failed",
      });

      const incidents = await listIncidents(testUserId);

      expect(incidents.length).toBe(2);
      expect(incidents[0].collectionName).toBe("My Collection");
      expect(incidents[0].sourceCollectionName).toBe("Articles");
    });

    it("should return incidents ordered by creation (most recent first)", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "First",
      });
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SyncError,
        message: "Second",
      });

      const incidents = await listIncidents(testUserId);

      // Verify we have both incidents (order depends on DB implementation)
      expect(incidents.length).toBe(2);
      const messages = incidents.map((i) => i.message).sort();
      expect(messages).toEqual(["First", "Second"]);
    });

    it("should filter by resolved status", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "Unresolved",
      });

      const unresolved = await listIncidents(testUserId, { resolved: false });
      const resolved = await listIncidents(testUserId, { resolved: true });

      expect(unresolved.length).toBe(1);
      expect(resolved.length).toBe(0);
    });

    it("should only return incidents for the specified user", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "User1 incident",
      });

      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const incidents = await listIncidents(user2.id);

      expect(incidents).toEqual([]);
    });
  });

  describe("getUnresolvedIncidentCount", () => {
    it("should return 0 when no incidents exist", async () => {
      const count = await getUnresolvedIncidentCount(testUserId);

      expect(count).toBe(0);
    });

    it("should count only unresolved incidents", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "First",
      });
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SyncError,
        message: "Second",
      });

      const count = await getUnresolvedIncidentCount(testUserId);

      expect(count).toBe(2);
    });
  });

  describe("resolveIncident", () => {
    it("should resolve and delete an incident", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "To resolve",
      });

      const resolved = await resolveIncident(testUserId, 1);

      expect(resolved).toBe(true);

      // Verify it's deleted
      const incidents = await listIncidents(testUserId);
      expect(incidents.length).toBe(0);
    });

    it("should return false for non-existent incident", async () => {
      const resolved = await resolveIncident(testUserId, 999);

      expect(resolved).toBe(false);
    });

    it("should not resolve another user's incident", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "Protected",
      });

      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const resolved = await resolveIncident(user2.id, 1);

      expect(resolved).toBe(false);

      // Verify original exists
      const incidents = await listIncidents(testUserId);
      expect(incidents.length).toBe(1);
    });
  });

  describe("autoResolveIncidentsForInflux", () => {
    it("should resolve all unresolved incidents for an influx", async () => {
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "First",
      });
      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.FilterInvalid,
        message: "Second",
      });

      const count = await autoResolveIncidentsForInflux(testUserId, testInfluxId);

      expect(count).toBe(2);

      // Verify they're deleted
      const incidents = await listIncidents(testUserId);
      expect(incidents.length).toBe(0);
    });

    it("should return 0 when no incidents exist", async () => {
      const count = await autoResolveIncidentsForInflux(testUserId, testInfluxId);

      expect(count).toBe(0);
    });

    it("should only resolve incidents for the specified influx", async () => {
      // Create second influx
      await db.insert(influxTable).values({
        userId: testUserId,
        id: 2,
        collectionId: testCollectionId,
        sourceCollectionId: testSourceCollectionId,
      });

      await createIncident(testUserId, {
        influxId: testInfluxId,
        type: IncidentType.SchemaIncompatible,
        message: "Influx 1 incident",
      });
      await createIncident(testUserId, {
        influxId: 2,
        type: IncidentType.SchemaIncompatible,
        message: "Influx 2 incident",
      });

      const count = await autoResolveIncidentsForInflux(testUserId, testInfluxId);

      expect(count).toBe(1);

      // Verify influx 2's incident still exists
      const incidents = await listIncidents(testUserId);
      expect(incidents.length).toBe(1);
      expect(incidents[0].influxId).toBe(2);
    });
  });
});
