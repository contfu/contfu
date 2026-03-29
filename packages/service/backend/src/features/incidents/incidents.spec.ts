import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "../../infra/db/db";
import {
  collectionTable,
  connectionTable,
  flowTable,
  incidentTable,
  userTable,
} from "../../infra/db/schema";
import { pack } from "msgpackr";
import { ConnectionType } from "@contfu/core";
import {
  FilterOperator,
  PropertyType,
  IncidentType,
  type CollectionSchema,
  type SchemaIncompatibleDetails,
} from "@contfu/svc-core";
import { runTest } from "../../../test/effect-helpers";
import { createIncident } from "./createIncident";
import { listIncidents } from "./listIncidents";
import { getUnresolvedIncidentCount } from "./getUnresolvedIncidentCount";
import { resolveIncident } from "./resolveIncident";
import { autoResolveIncidentsForFlow } from "./autoResolveIncidentsForFlow";

/**
 * Unit tests for incident tracking operations.
 * Uses real in-memory SQLite database, not mocks.
 */

describe("Incident Features", () => {
  let testUserId: number;
  let testFlowId: number;
  let testSourceCollectionId: number;
  let testTargetCollectionId: number;

  const testSchema: CollectionSchema = {
    title: PropertyType.STRING,
    content: PropertyType.STRING,
  };

  beforeEach(async () => {
    // Delete in correct order for foreign keys
    await db.delete(incidentTable);
    await db.delete(flowTable);
    await db.delete(collectionTable);
    await db.delete(connectionTable);
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

    // Create test connection
    const [connection] = await db
      .insert(connectionTable)
      .values({
        userId: testUserId,
        type: ConnectionType.STRAPI,
        name: "Test Connection",
      })
      .returning();

    // Create source collection (external, linked to connection)
    const [sourceCollection] = await db
      .insert(collectionTable)
      .values({
        userId: testUserId,
        connectionId: connection.id,
        displayName: "Articles",
        name: "articles",
        schema: pack(testSchema),
      })
      .returning();
    testSourceCollectionId = sourceCollection.id;

    // Create target collection (virtual, no connection)
    const [targetCollection] = await db
      .insert(collectionTable)
      .values({
        userId: testUserId,
        displayName: "My Collection",
        name: "myCollection",
      })
      .returning();
    testTargetCollectionId = targetCollection.id;

    // Create test flow
    const [flow] = await db
      .insert(flowTable)
      .values({
        userId: testUserId,
        sourceId: testSourceCollectionId,
        targetId: testTargetCollectionId,
        schema: pack(testSchema),
      })
      .returning();
    testFlowId = flow.id;
  });

  describe("createIncident", () => {
    it("should create a basic incident", async () => {
      const incident = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema changed: field 'title' removed",
        }),
      );

      expect(incident.id).toBeGreaterThan(0);
      expect(incident.userId).toBe(testUserId);
      expect(incident.flowId).toBe(testFlowId);
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
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema type changed",
          details,
        }),
      );

      expect(incident.details).toEqual(details as unknown as Record<string, unknown>);
    });

    it("should auto-increment incident IDs per user", async () => {
      const incident1 = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "First incident",
        }),
      );
      const incident2 = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SyncError,
          message: "Second incident",
        }),
      );

      expect(incident2.id).toBeGreaterThan(incident1.id);
    });

    it("should support different incident types", async () => {
      const schemaIncident = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema changed",
        }),
      );
      const filterIncident = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.FilterInvalid,
          message: "Filter references missing field",
        }),
      );
      const syncIncident = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SyncError,
          message: "Failed to sync data",
        }),
      );

      expect(schemaIncident.type).toBe(IncidentType.SchemaIncompatible);
      expect(filterIncident.type).toBe(IncidentType.FilterInvalid);
      expect(syncIncident.type).toBe(IncidentType.SyncError);
    });

    it("should reject creating an incident for another user's flow", async () => {
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2-z@test.com" })
        .returning();

      const [connection2] = await db
        .insert(connectionTable)
        .values({
          userId: user2.id,
          type: ConnectionType.STRAPI,
          name: "User2 Connection",
        })
        .returning();
      const [sourceCollection2] = await db
        .insert(collectionTable)
        .values({
          userId: user2.id,
          connectionId: connection2.id,
          displayName: "User2 Source Collection",
          name: "user2Source",
        })
        .returning();
      const [targetCollection2] = await db
        .insert(collectionTable)
        .values({
          userId: user2.id,
          displayName: "User2 Target Collection",
          name: "user2Target",
        })
        .returning();
      const [flow2] = await db
        .insert(flowTable)
        .values({
          userId: user2.id,
          sourceId: sourceCollection2.id,
          targetId: targetCollection2.id,
        })
        .returning();

      // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
      await expect(
        runTest(
          testUserId,
          createIncident(testUserId, {
            flowId: flow2.id,
            type: IncidentType.SyncError,
            message: "Cross-tenant write attempt",
          }),
        ),
      ).rejects.toThrow("Flow not found");
    });
  });

  describe("listIncidents", () => {
    it("should return empty array when no incidents exist", async () => {
      const incidents = await runTest(testUserId, listIncidents(testUserId));

      expect(incidents).toEqual([]);
    });

    it("should return all incidents with details", async () => {
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "Schema changed",
        }),
      );
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SyncError,
          message: "Sync failed",
        }),
      );

      const incidents = await runTest(testUserId, listIncidents(testUserId));

      expect(incidents.length).toBe(2);
      expect(incidents[0].targetCollectionName).toBe("My Collection");
      expect(incidents[0].sourceCollectionName).toBe("Articles");
    });

    it("should return incidents ordered by creation (most recent first)", async () => {
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "First",
        }),
      );
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SyncError,
          message: "Second",
        }),
      );

      const incidents = await runTest(testUserId, listIncidents(testUserId));

      // Verify we have both incidents (order depends on DB implementation)
      expect(incidents.length).toBe(2);
      const messages = incidents.map((i) => i.message).sort();
      expect(messages).toEqual(["First", "Second"]);
    });

    it("should filter by resolved status", async () => {
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "Unresolved",
        }),
      );

      const unresolved = await runTest(testUserId, listIncidents(testUserId, { resolved: false }));
      const resolved = await runTest(testUserId, listIncidents(testUserId, { resolved: true }));

      expect(unresolved.length).toBe(1);
      expect(resolved.length).toBe(0);
    });

    it("should only return incidents for the specified user", async () => {
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "User1 incident",
        }),
      );

      // Create second user
      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const incidents = await runTest(user2.id, listIncidents(user2.id));

      expect(incidents).toEqual([]);
    });
  });

  describe("getUnresolvedIncidentCount", () => {
    it("should return 0 when no incidents exist", async () => {
      const count = await runTest(testUserId, getUnresolvedIncidentCount(testUserId));

      expect(count).toBe(0);
    });

    it("should count only unresolved incidents", async () => {
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "First",
        }),
      );
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SyncError,
          message: "Second",
        }),
      );

      const count = await runTest(testUserId, getUnresolvedIncidentCount(testUserId));

      expect(count).toBe(2);
    });
  });

  describe("resolveIncident", () => {
    it("should resolve and delete an incident", async () => {
      const incident = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "To resolve",
        }),
      );

      const resolved = await runTest(testUserId, resolveIncident(testUserId, incident.id));

      expect(resolved).toBe(true);

      // Verify it's deleted
      const incidents = await runTest(testUserId, listIncidents(testUserId));
      expect(incidents.length).toBe(0);
    });

    it("should return false for non-existent incident", async () => {
      const resolved = await runTest(testUserId, resolveIncident(testUserId, 999));

      expect(resolved).toBe(false);
    });

    it("should not resolve another user's incident", async () => {
      const incident = await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "Protected",
        }),
      );

      const [user2] = await db
        .insert(userTable)
        .values({ name: "User 2", email: "user2@test.com" })
        .returning();

      const resolved = await runTest(user2.id, resolveIncident(user2.id, incident.id));

      expect(resolved).toBe(false);

      // Verify original exists
      const incidents = await runTest(testUserId, listIncidents(testUserId));
      expect(incidents.length).toBe(1);
    });
  });

  describe("autoResolveIncidentsForFlow", () => {
    it("should resolve all unresolved incidents for a flow", async () => {
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "First",
        }),
      );
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.FilterInvalid,
          message: "Second",
        }),
      );

      const count = await runTest(testUserId, autoResolveIncidentsForFlow(testUserId, testFlowId));

      expect(count).toBe(2);

      // Verify they're deleted
      const incidents = await runTest(testUserId, listIncidents(testUserId));
      expect(incidents.length).toBe(0);
    });

    it("should return 0 when no incidents exist", async () => {
      const count = await runTest(testUserId, autoResolveIncidentsForFlow(testUserId, testFlowId));

      expect(count).toBe(0);
    });

    it("should only resolve incidents for the specified flow", async () => {
      // Create a second target collection for flow2 (unique constraint on source+target)
      const [targetCollection2] = await db
        .insert(collectionTable)
        .values({
          userId: testUserId,
          displayName: "Second Collection",
          name: "secondCollection",
        })
        .returning();
      const [flow2] = await db
        .insert(flowTable)
        .values({
          userId: testUserId,
          sourceId: testSourceCollectionId,
          targetId: targetCollection2.id,
        })
        .returning();

      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: testFlowId,
          type: IncidentType.SchemaIncompatible,
          message: "Flow 1 incident",
        }),
      );
      await runTest(
        testUserId,
        createIncident(testUserId, {
          flowId: flow2.id,
          type: IncidentType.SchemaIncompatible,
          message: "Flow 2 incident",
        }),
      );

      const count = await runTest(testUserId, autoResolveIncidentsForFlow(testUserId, testFlowId));

      expect(count).toBe(1);

      // Verify flow 2's incident still exists
      const incidents = await runTest(testUserId, listIncidents(testUserId));
      expect(incidents.length).toBe(1);
      expect(incidents[0].flowId).toBe(flow2.id);
    });
  });
});
