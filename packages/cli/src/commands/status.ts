import { createApiClient, ApiError, IntegrationType, IntegrationTypeMeta } from "@contfu/svc-api";
import type { ApiIntegration, ServiceCollection, ServiceFlow } from "@contfu/svc-api";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL, getApiKey } from "../http";
import { getAppKey } from "../env";

function resolveTypeLabel(type: number): string {
  const meta = IntegrationTypeMeta[type as keyof typeof IntegrationTypeMeta];
  return meta?.label ?? `unknown(${type})`;
}

export interface StatusResult {
  authenticated: boolean;
  integrations: Array<ApiIntegration & { typeLabel: string }>;
  collections: ServiceCollection[];
  flows: ServiceFlow[];
  appKey?: { present: boolean; source: "env" | "dotenv" };
}

function printTable(result: StatusResult) {
  console.log("contfu status");
  console.log("=============\n");

  console.log("Authenticated: yes\n");

  const sources = result.integrations.filter((c) => c.type !== IntegrationType.APP);
  const applicationIntegrations = result.integrations.filter((c) => c.type === IntegrationType.APP);

  console.log(`Integrations (${result.integrations.length})`);
  console.log("─".repeat(60));
  if (sources.length > 0) {
    for (const c of sources) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)} ${c.typeLabel}`);
    }
  }
  if (applicationIntegrations.length > 0) {
    for (const c of applicationIntegrations) {
      console.log(`  ${c.id}  ${c.name.padEnd(30)} ${c.typeLabel}`);
    }
  }
  if (result.integrations.length === 0) {
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

  const apiClient = createApiClient(BASE_URL, apiKey);

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
    const [integrations, collections, flows] = await Promise.all([
      apiClient.listIntegrations(),
      apiClient.listCollections(),
      apiClient.listFlows(),
    ]);

    const result: StatusResult = {
      authenticated: true,
      integrations: integrations.map((c) => ({ ...c, typeLabel: resolveTypeLabel(c.type) })),
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
