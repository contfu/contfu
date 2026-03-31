#!/usr/bin/env bun
/**
 * CLI tool to test binary stream connections
 *
 * Usage:
 *   bun stream-cli.ts
 *
 * Environment variables:
 *   CONTFU_KEY  - Authentication key in base64url format
 */

import { connectToStream } from "@contfu/connect";
import { EventType } from "@contfu/core";

// Configuration from environment
const CONTFU_KEY = process.env.CONTFU_KEY || "";

if (!CONTFU_KEY) {
  console.error("❌ Error: CONTFU_KEY environment variable is required");
  console.error("Usage: CONTFU_KEY=<hex_key> bun stream-cli.ts");
  process.exit(1);
}

console.log("🔌 Binary Stream CLI Test Tool");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(
  `🔑 Using key: ${CONTFU_KEY.substring(0, 8)}...${CONTFU_KEY.substring(CONTFU_KEY.length - 8)}`,
);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Convert hex key to Buffer
const key = Buffer.from(CONTFU_KEY, "base64url");

console.log("⏳ Establishing connection...\n");

try {
  for await (const event of connectToStream({ key, connectionEvents: true })) {
    const timestamp = new Date().toISOString();

    if (event.type === "stream:connected") {
      console.log(`[${timestamp}] ✅ CONNECTED`);
      console.log("   Connection established successfully\n");
      continue;
    }

    if (event.type === "stream:disconnected") {
      console.log(`[${timestamp}] ⚠️  DISCONNECTED`);
      console.log(`   Reason: ${event.reason || "Unknown"}\n`);
      continue;
    }

    switch (event.type) {
      case EventType.ITEM_CHANGED:
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

      case EventType.ITEM_DELETED:
        console.log(`[${timestamp}] 🗑️  DELETED`);
        console.log(`   Item ID: ${event.item.toString("hex")}`);
        console.log("");
        break;

      default:
        console.log(`[${timestamp}] ❓ UNKNOWN EVENT`);
        console.log(`   Type: ${(event as { type: unknown }).type}`);
        console.log(`   Data: ${JSON.stringify(event, null, 2)}`);
        console.log("");
    }
  }

  console.log("🔌 Connection closed");
} catch (error) {
  console.error("\n❌ Connection failed:", error);
  process.exit(1);
}
