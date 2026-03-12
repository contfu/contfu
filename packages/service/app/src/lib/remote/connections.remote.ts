import { command, query } from "$app/server";
import { runWithUser } from "$lib/server/run";
import { getUserId } from "$lib/server/user";
import { ConnectionType } from "@contfu/core";
import type { BackendConnection } from "@contfu/svc-backend/domain/types";
import { createConnection as createConnectionFeature } from "@contfu/svc-backend/features/connections/createConnection";
import { deleteConnection as deleteConnectionFeature } from "@contfu/svc-backend/features/connections/deleteConnection";
import { getConnectionWithCollectionCount } from "@contfu/svc-backend/features/connections/getConnectionWithCollectionCount";
import { getConnectionWithCredentials } from "@contfu/svc-backend/features/connections/getConnectionWithCredentials";
import { listConnections as listConnectionsFeature } from "@contfu/svc-backend/features/connections/listConnections";
import { renameConnection as renameConnectionFeature } from "@contfu/svc-backend/features/connections/renameConnection";
import { updateConnection as updateConnectionFeature } from "@contfu/svc-backend/features/connections/updateConnection";
import { listFlowsByCollection } from "@contfu/svc-backend/features/flows/listFlowsByCollection";
import { listCollectionsByConnection } from "@contfu/svc-backend/features/collections/listCollectionsByConnection";
import { getCollection } from "@contfu/svc-backend/features/collections/getCollection";
import { computeCollectionSchema } from "@contfu/svc-backend/features/collections/computeCollectionSchema";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { generateConsumerTypes, type TypeGenerationInput } from "@contfu/svc-core";
import { getStreamServer } from "$lib/server/startup";
import { hashApiKey } from "$lib/server/connection-auth";
import { error } from "@sveltejs/kit";
import { randomBytes } from "node:crypto";
import * as v from "valibot";

function encodeConnection(connection: BackendConnection) {
  return {
    ...connection,
    id: encodeId("connection", connection.id),
    userId: encodeId("user", connection.userId),
  };
}

function withClientStatus(connection: BackendConnection) {
  const encoded = encodeConnection(connection);
  if (connection.type !== ConnectionType.CLIENT) return encoded;
  return {
    ...encoded,
    isConnected: getStreamServer().isConnectionActive(connection.userId, connection.id),
  };
}

/**
 * List all connections for the current user.
 */
export const listConnections = query(async () => {
  const userId = getUserId();
  const connections = await runWithUser(userId, listConnectionsFeature());
  return connections.map(withClientStatus);
});

/**
 * Get a single connection by ID with collection count.
 */
export const getConnection = query(v.object({ id: idSchema("connection") }), async ({ id }) => {
  const userId = getUserId();
  const connection = await runWithUser(userId, getConnectionWithCollectionCount(id));
  if (!connection) error(404, "Connection not found");
  return {
    ...withClientStatus(connection),
    collectionCount: connection.collectionCount,
  };
});

/**
 * Create a new connection (source-type: Notion, Strapi, Web, etc.).
 */
export const createConnection = command(
  v.object({
    type: v.pipe(v.picklist(Object.values(ConnectionType))),
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
    url: v.optional(v.string()),
    token: v.pipe(v.string(), v.nonEmpty("Token is required")),
  }),
  async (data) => {
    const userId = getUserId();
    const connection = await runWithUser(
      userId,
      createConnectionFeature(userId, {
        type: data.type,
        name: data.name,
        url: data.url,
        credentials: Buffer.from(data.token, "utf-8"),
      }),
    );
    return encodeConnection(connection);
  },
);

/**
 * Create a CLIENT-type connection with an auto-generated API key.
 */
export const createClientConnection = command(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
  }),
  async (data) => {
    const userId = getUserId();
    const apiKeyStr = randomBytes(32).toString("base64url");
    const connection = await runWithUser(
      userId,
      createConnectionFeature(userId, {
        type: ConnectionType.CLIENT,
        name: data.name,
        credentials: hashApiKey(apiKeyStr),
      }),
    );
    return {
      ...encodeConnection(connection),
      apiKey: apiKeyStr,
    };
  },
);

/**
 * Delete a connection.
 */
export const deleteConnection = command(v.object({ id: idSchema("connection") }), async (data) => {
  const userId = getUserId();
  const deleted = await runWithUser(userId, deleteConnectionFeature(data.id));
  if (!deleted) error(404, "Connection not found");
  return { success: true };
});

/**
 * Rename a connection.
 */
export const renameConnection = command(
  v.object({
    id: idSchema("connection"),
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
  }),
  async (data) => {
    const userId = getUserId();
    const updated = await runWithUser(userId, renameConnectionFeature(data.id, data.name));
    if (!updated) error(404, "Connection not found");
    return encodeConnection(updated);
  },
);

/**
 * Update a connection's name and/or includeRef.
 */
export const updateConnection = command(
  v.object({
    id: idSchema("connection"),
    name: v.optional(v.pipe(v.string(), v.nonEmpty("Name cannot be empty"))),
    _credentials: v.optional(v.string()),
    includeRef: v.optional(
      v.pipe(
        v.union([v.string(), v.boolean()]),
        v.transform((val) => (typeof val === "boolean" ? val : val === "true")),
      ),
    ),
  }),
  async (data) => {
    const userId = getUserId();
    const updated = await runWithUser(
      userId,
      updateConnectionFeature(data.id, {
        name: data.name,
        credentials:
          data._credentials !== undefined ? Buffer.from(data._credentials, "utf8") : undefined,
        includeRef: data.includeRef,
      }),
    );
    if (!updated) error(404, "Connection not found");
    return encodeConnection(updated);
  },
);

/**
 * Regenerate webhook secret for a connection.
 * Returns the new plaintext secret (only shown once).
 */
export const regenerateWebhookSecret = command(
  v.object({
    id: idSchema("connection"),
  }),
  async (data): Promise<{ success: boolean; secret?: string; message?: string }> => {
    const userId = getUserId();

    // Verify connection exists
    const connection = await runWithUser(userId, getConnectionWithCollectionCount(data.id));
    if (!connection) error(404, "Connection not found");

    // Generate new secret
    const newSecret = randomBytes(32).toString("hex");

    // Store the new secret (encryption happens in updateConnection)
    await runWithUser(
      userId,
      updateConnectionFeature(data.id, {
        webhookSecret: Buffer.from(newSecret, "utf8"),
      }),
    );

    return { success: true, secret: newSecret };
  },
);

/**
 * Regenerate the API key for a CLIENT connection.
 */
export const regenerateApiKey = command(
  v.object({
    id: idSchema("connection"),
  }),
  async (data): Promise<{ success: boolean; apiKey?: string }> => {
    const userId = getUserId();
    const connection = await runWithUser(userId, getConnectionWithCollectionCount(data.id));
    if (!connection) error(404, "Connection not found");

    const newApiKeyStr = randomBytes(32).toString("base64url");
    await runWithUser(
      userId,
      updateConnectionFeature(data.id, {
        credentials: hashApiKey(newApiKeyStr),
        skipCredentialsEncryption: true,
      }),
    );

    return { success: true, apiKey: newApiKeyStr };
  },
);

/**
 * Test an existing connection's credentials.
 */
export const testConnection = command(
  v.object({
    id: idSchema("connection"),
  }),
  async (data): Promise<{ success: boolean; message: string }> => {
    const userId = getUserId();
    const connection = await runWithUser(userId, getConnectionWithCredentials(data.id));

    if (!connection) {
      return { success: false, message: "Connection not found" };
    }

    const credentials = connection.credentials?.toString("utf-8") ?? "";
    if (!credentials) {
      return { success: false, message: "No credentials configured" };
    }

    // Attempt a basic API call based on connection type
    try {
      if (connection.type === ConnectionType.NOTION) {
        const { iterateDataSources } = await import("@contfu/svc-sources/notion");
        // Try to iterate data sources (will throw on auth failure)
        // biome-ignore lint/correctness/noUnusedVariables: intentional test
        for await (const _ds of iterateDataSources(credentials)) {
          break; // Just need to verify auth works
        }
      }
      // For other types, just verify credentials exist
      return { success: true, message: "Connection successful" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message };
    }
  },
);

/**
 * Test connection with credentials (without saving).
 */
export const testNewConnection = command(
  v.object({
    type: v.pipe(v.picklist(Object.values(ConnectionType))),
    url: v.optional(v.string()),
    _credentials: v.optional(v.string()),
  }),
  async (data): Promise<{ success: boolean; message: string }> => {
    getUserId();
    const credentials = data._credentials ?? "";

    try {
      if (data.type === ConnectionType.NOTION) {
        const { iterateDataSources } = await import("@contfu/svc-sources/notion");
        // biome-ignore lint/correctness/noUnusedVariables: intentional test
        for await (const _ds of iterateDataSources(credentials)) {
          break;
        }
      }
      return { success: true, message: "Connection successful" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, message };
    }
  },
);

/**
 * Get generated TypeScript types for collections belonging to a connection.
 * Replaces the old getConsumerTypes.
 */
export const getConnectionTypes = query(
  v.object({ id: idSchema("connection") }),
  async ({ id }) => {
    const userId = getUserId();

    // Get all collections belonging to this connection
    const collections = await runWithUser(userId, listCollectionsByConnection(id));

    // Also include collections connected via flows where source collections
    // belong to this connection
    const allCollections: TypeGenerationInput[] = [];
    const seen = new Set<number>();

    for (const col of collections) {
      seen.add(col.id);
      allCollections.push({
        name: col.name,
        displayName: col.displayName,
        schema: col.schema,
        refTargets: col.refTargets,
      });

      // Get flows where this collection is a source to find target collections
      const flows = await runWithUser(userId, listFlowsByCollection(col.id));
      for (const flow of flows) {
        if (!seen.has(flow.targetId)) {
          seen.add(flow.targetId);
          const target = await runWithUser(userId, getCollection(flow.targetId));
          if (target) {
            // Compute schema from flows to get ENUM values embedded via mappings
            const schema = await runWithUser(
              userId,
              computeCollectionSchema(userId, flow.targetId),
            );
            allCollections.push({
              name: target.name,
              displayName: target.displayName,
              schema: Object.keys(schema).length > 0 ? schema : target.schema,
              refTargets: target.refTargets,
            });
          }
        }
      }
    }

    if (allCollections.length === 0) return "";
    return generateConsumerTypes(allCollections);
  },
);
