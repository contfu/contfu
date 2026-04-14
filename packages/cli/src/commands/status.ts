import { createApiClient, ApiError, ConnectionTypeMeta } from "@contfu/svc-api";
import type { ApiConnection, ServiceCollection, ServiceFlow } from "@contfu/svc-api";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getApiKey, getBaseUrl } from "../http";
import { getAppKey } from "../env";

function resolveTypeLabel(type: number): string {
  const meta = ConnectionTypeMeta[type as keyof typeof ConnectionTypeMeta];
  return meta?.label ?? `unknown(${type})`;
}

export interface StatusResult {
  authenticated: boolean;
  connections: Array<ApiConnection & { typeLabel: string }>;
  collections: ServiceCollection[];
  flows: ServiceFlow[];
  appKey?: { present: boolean; source: "env" | "dotenv" };
}

function printTable(result: StatusResult) {
  console.log("contfu status");
  console.log("=============\n");

  console.log("Authenticated: yes\n");

  const sources = result.connections.filter((c) => c.typeLabel !== "app");
  const clients = result.connections.filter((c) => c.typeLabel === "app");

  console.log(`Connections (${result.connections.length})`);
  console.log("─".repeat(60));
  if (sources.length > 0) {
    for (const c of sources) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)} ${c.typeLabel}`);
    }
  }
  if (clients.length > 0) {
    for (const c of clients) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)} app`);
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

  if (result.appKey) {
    console.log("\nApp project");
    console.log("─".repeat(60));
    if (result.appKey.present) {
      const src = result.appKey.source === "env" ? "CONTFU_KEY env var" : ".env file";
      console.log(`  CONTFU_KEY: found (${src})`);
    } else {
      console.log("  CONTFU_KEY: not set");
      console.log("  Run `contfu setup` to configure this project as an app.");
    }
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

  const apiClient = createApiClient(getBaseUrl(), apiKey);

  // Detect app project context
  let appKeyInfo: StatusResult["appKey"];
  if (process.env.CONTFU_KEY) {
    appKeyInfo = { present: true, source: "env" };
  } else {
    const fromDotenv = getAppKey();
    if (fromDotenv !== undefined) {
      appKeyInfo = { present: true, source: "dotenv" };
    } else {
      // Only show the section if there's a .env file or CONTFU_KEY is relevant
      const envPath = join(process.cwd(), ".env");
      if (existsSync(envPath)) {
        appKeyInfo = { present: false, source: "dotenv" };
      }
    }
  }

  try {
    const [connections, collections, flows] = await Promise.all([
      apiClient.listConnections(),
      apiClient.listCollections(),
      apiClient.listFlows(),
    ]);

    const result: StatusResult = {
      authenticated: true,
      connections: connections.map((c) => ({ ...c, typeLabel: resolveTypeLabel(c.type) })),
      collections,
      flows,
      ...(appKeyInfo !== undefined ? { appKey: appKeyInfo } : {}),
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
