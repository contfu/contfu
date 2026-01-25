#!/usr/bin/env bun
/**
 * CLI tool to test SSE connections
 *
 * Usage:
 *   bun sse-cli.ts
 *
 * Environment variables:
 *   CONTFU_URL  - SSE endpoint URL (default: http://localhost:5173/api/sse)
 *   CONTFU_KEY  - Consumer key in hex format
 */

import { connectToSSE } from "@contfu/client";
import { EventType } from "@contfu/core";
import EventSource from "eventsource";

// Configuration from environment
const CONTFU_URL = process.env.CONTFU_URL || "http://localhost:5173/api/sse";
const CONTFU_KEY = process.env.CONTFU_KEY || "";

if (!CONTFU_KEY) {
  console.error("❌ Error: CONTFU_KEY environment variable is required");
  console.error("Usage: CONTFU_KEY=<hex_key> bun sse-cli.ts");
  process.exit(1);
}

console.log("🔌 SSE CLI Test Tool");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📡 Connecting to: ${CONTFU_URL}`);
console.log(
  `🔑 Using key: ${CONTFU_KEY.substring(0, 8)}...${CONTFU_KEY.substring(CONTFU_KEY.length - 8)}`,
);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Convert hex key to Buffer
const key = Buffer.from(CONTFU_KEY, "hex");

// Event handler that logs all events
const eventHandler = async (event: any) => {
  const timestamp = new Date().toISOString();

  switch (event.type) {
    case EventType.CONNECTED:
      console.log(`[${timestamp}] ✅ CONNECTED`);
      console.log("   Connection established successfully\n");
      break;

    case EventType.CHANGED:
      console.log(`[${timestamp}] 📝 CHANGED`);
      console.log(`   Collection: ${event.item.collection}`);
      console.log(`   ID: ${event.item.id.toString("hex")}`);
      console.log(`   Ref: ${event.item.ref.toString("hex")}`);
      console.log(`   Created: ${event.item.createdAt}`);
      console.log(`   Changed: ${event.item.changedAt}`);
      if (event.item.publishedAt) {
        console.log(`   Published: ${event.item.publishedAt}`);
      }
      if (event.item.props) {
        console.log(`   Props: ${JSON.stringify(event.item.props, null, 2)}`);
      }
      if (event.item.content) {
        console.log(`   Content blocks: ${event.item.content.length}`);
      }
      console.log("");
      break;

    case EventType.DELETED:
      console.log(`[${timestamp}] 🗑️  DELETED`);
      console.log(`   Item ID: ${event.item.toString("hex")}`);
      console.log("");
      break;

    case EventType.LIST_IDS:
      console.log(`[${timestamp}] 📋 LIST_IDS`);
      console.log(`   Collection: ${event.collection}`);
      console.log(`   Count: ${event.ids.length} items`);
      if (event.ids.length > 0 && event.ids.length <= 5) {
        console.log(
          `   IDs: ${event.ids.map((id: Buffer) => id.toString("hex").substring(0, 16) + "...").join(", ")}`,
        );
      }
      console.log("");
      break;

    case EventType.CHECKSUM:
      console.log(`[${timestamp}] 🔢 CHECKSUM`);
      console.log(`   Collection: ${event.collection}`);
      console.log(`   Checksum: ${event.checksum.toString("hex")}`);
      console.log("");
      break;

    case EventType.ERROR:
      console.log(`[${timestamp}] ❌ ERROR`);
      console.log(`   Error code: ${event.code}`);
      console.log("");
      break;

    default:
      console.log(`[${timestamp}] ❓ UNKNOWN EVENT`);
      console.log(`   Type: ${event.type}`);
      console.log(`   Data: ${JSON.stringify(event, null, 2)}`);
      console.log("");
  }
};

// Connect and log events
try {
  console.log("⏳ Establishing connection...\n");

  await connectToSSE(key, {
    url: CONTFU_URL,
    handle: eventHandler,
    EventSource: EventSource as any,
    reconnect: true,
  });

  console.log("🔌 Connection closed");
} catch (error) {
  console.error("\n❌ Connection failed:", error);
  process.exit(1);
}
