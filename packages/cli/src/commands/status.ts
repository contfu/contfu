import { createApiClient, ApiError, ConnectionTypeMeta } from "@contfu/svc-api";
import type { ApiConnection, ServiceCollection, ServiceFlow } from "@contfu/svc-api";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function getApiKey(): string | undefined {
  if (process.env.CONTFU_API_KEY) return process.env.CONTFU_API_KEY;
  try {
    const configPath = join(homedir(), ".config", "contfu", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config.apiKey;
  } catch {
    return undefined;
  }
}

function getBaseUrl(): string {
  return process.env.CONTFU_URL ?? "https://contfu.com";
}

function resolveTypeLabel(type: number): string {
  const meta = ConnectionTypeMeta[type as keyof typeof ConnectionTypeMeta];
  return meta?.label ?? `unknown(${type})`;
}

export interface StatusResult {
  authenticated: boolean;
  connections: Array<ApiConnection & { typeLabel: string }>;
  collections: ServiceCollection[];
  flows: ServiceFlow[];
}

function printTable(result: StatusResult) {
  console.log("contfu status");
  console.log("=============\n");

  console.log("Authenticated: yes\n");

  const sources = result.connections.filter((c) => c.typeLabel !== "client");
  const clients = result.connections.filter((c) => c.typeLabel === "client");

  console.log(`Connections (${result.connections.length})`);
  console.log("─".repeat(60));
  if (sources.length > 0) {
    for (const c of sources) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)} ${c.typeLabel}`);
    }
  }
  if (clients.length > 0) {
    for (const c of clients) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)} client`);
    }
  }
  if (result.connections.length === 0) {
    console.log("  (none)");
  }

  console.log(`\nCollections (${result.collections.length})`);
  console.log("─".repeat(60));
  if (result.collections.length > 0) {
    for (const c of result.collections) {
      const flowInfo = c.flowSourceCount > 0 ? `${c.flowSourceCount} flow(s)` : "no flows";
      console.log(`  ${c.id}  ${(c.displayName ?? c.name).padEnd(30)} ${flowInfo}`);
    }
  } else {
    console.log("  (none)");
  }

  console.log(`\nFlows (${result.flows.length})`);
  console.log("─".repeat(60));
  if (result.flows.length > 0) {
    for (const f of result.flows) {
      console.log(`  ${f.id}  source:${f.sourceId} → target:${f.targetId}`);
    }
  } else {
    console.log("  (none)");
  }
}

export async function status(format = "table"): Promise<void> {
  const apiKey = getApiKey();

  if (!apiKey) {
    if (format === "json") {
      console.log(JSON.stringify({ authenticated: false }, null, 2));
    } else {
      console.log("Not authenticated. Run `contfu login` or set CONTFU_API_KEY.");
    }
    return;
  }

  const client = createApiClient(getBaseUrl(), apiKey);

  try {
    const [connections, collections, flows] = await Promise.all([
      client.listConnections(),
      client.listCollections(),
      client.listFlows(),
    ]);

    const result: StatusResult = {
      authenticated: true,
      connections: connections.map((c) => ({ ...c, typeLabel: resolveTypeLabel(c.type) })),
      collections,
      flows,
    };

    if (format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printTable(result);
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      if (format === "json") {
        console.log(JSON.stringify({ authenticated: false }, null, 2));
      } else {
        console.log("Not authenticated. Run `contfu login` or set CONTFU_API_KEY.");
      }
      return;
    }
    throw err;
  }
}
