/**
 * CLI event logger — connects to the contfu service and prints all received events.
 *
 * Configuration:
 *   CONTFU_KEY  Authentication key (base64url). Falls back to `key` in ~/.config/contfu/config.json.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { connect } from "@contfu/connect";
import { EventType } from "@contfu/core";

function getKey(): Buffer | undefined {
  const envKey = process.env.CONTFU_KEY;
  if (envKey) return Buffer.from(envKey, "base64url");

  try {
    const configPath = join(homedir(), ".config", "contfu", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as { key?: string };
    if (config.key) return Buffer.from(config.key, "base64url");
  } catch {
    // no config file
  }

  return undefined;
}

function timestamp(): string {
  return new Date().toISOString();
}

function formatEvent(event: { type: number; [key: string]: unknown }): string {
  const typeName =
    Object.keys(EventType).find((k) => EventType[k as keyof typeof EventType] === event.type) ??
    `UNKNOWN(${event.type})`;

  const details: string[] = [];

  switch (event.type) {
    case EventType.STREAM_DISCONNECTED: {
      const e = event as { reason?: string };
      if (e.reason) details.push(`reason=${e.reason}`);
      break;
    }
    case EventType.ITEM_CHANGED: {
      const e = event as { item: { collection: string; id: Buffer; changedAt: number } };
      details.push(`collection=${e.item.collection}`);
      details.push(`id=${e.item.id.toString("hex").slice(0, 12)}…`);
      break;
    }
    case EventType.ITEM_DELETED: {
      const e = event as { item: Buffer };
      details.push(`id=${e.item.toString("hex").slice(0, 12)}…`);
      break;
    }
    case EventType.COLLECTION_SCHEMA: {
      const e = event as { collection: string; displayName: string };
      details.push(`collection=${e.collection}`);
      if (e.displayName !== e.collection) details.push(`displayName=${e.displayName}`);
      break;
    }
    case EventType.COLLECTION_RENAMED: {
      const e = event as { oldName: string; newName: string };
      details.push(`${e.oldName} → ${e.newName}`);
      break;
    }
    case EventType.COLLECTION_REMOVED: {
      const e = event as { collection: string };
      details.push(`collection=${e.collection}`);
      break;
    }
  }

  const suffix = details.length > 0 ? `  ${details.join("  ")}` : "";
  return `[${timestamp()}] ${typeName}${suffix}`;
}

const key = getKey();
if (!key) {
  console.error(
    'No authentication key found. Set CONTFU_KEY or add "key" to ~/.config/contfu/config.json',
  );
  process.exit(1);
}

console.log("Connecting to contfu service …");

for await (const event of connect({ key, connectionEvents: true, reconnect: true })) {
  console.log(formatEvent(event as { type: number; [key: string]: unknown }));
}
