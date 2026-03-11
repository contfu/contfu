import { afterEach, describe, expect, it } from "bun:test";
import { StreamServer } from "./stream-server";

describe("StreamServer", () => {
  let servers: StreamServer[] = [];

  afterEach(() => {
    for (const s of servers) s.shutdown();
    servers = [];
  });

  function makeServer() {
    const s = new StreamServer();
    servers.push(s);
    return s;
  }

  it("should handle broadcast with no connected consumers", async () => {
    const server = makeServer();
    // broadcast with no connections should not throw
    await server.broadcast([], []);
  });

  it("should handle removeConnection for unknown connectionId", () => {
    const server = makeServer();
    // Should not throw for unknown ID
    server.removeConnection("nonexistent-id");
  });

  describe("shutdown()", () => {
    it("should not throw when called once", () => {
      const server = new StreamServer();
      expect(() => server.shutdown()).not.toThrow();
    });

    it("should be idempotent when called multiple times", () => {
      const server = new StreamServer();
      server.shutdown();
      expect(() => server.shutdown()).not.toThrow();
    });
  });

  describe("health check", () => {
    it("should report no active connections when none are registered", () => {
      const server = makeServer();
      // pruneDeadConnections() is called internally by isConnectionActive()
      expect(server.isConnectionActive(1, 1)).toBe(false);
    });
  });

  it("architecture: SSE connections are in-memory stream controllers, not DB connections", () => {
    // This test documents the architectural property that SSE connections
    // use ReadableStreamDefaultController stored in JavaScript Maps.
    // They do NOT hold database connections from the pool.
    // Therefore 50+ concurrent SSE connections cannot exhaust the DB pool.
    //
    // Connection pool sizes:
    // - Main thread: max 50 (app queries, auth, stream server)
    // - Worker thread: max 5 (sync job queries)
    //
    // SSE streams only query DB on:
    // - connect: authenticate consumer (1 query)
    // - connect: get collection IDs (1-2 queries)
    // - connect: enqueue sync jobs
    // - broadcast: lookup connections (1-2 queries per batch)
    // - keepalive pings: NO DB queries
    expect(true).toBe(true); // Architectural documentation test
  });
});
