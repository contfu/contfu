import { ITEM_ID_SIZE } from "@contfu/core";
import { hash } from "crypto";

/**
 * Converts a hex UUID to a buffer.
 */
export function uuidToBuffer(uuid: string) {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/**
 * Calculates the id from a reference.
 * We use blake2b256, since it's fast and has a good collision resistance.
 */
export function genUid(ref: Buffer) {
  return hash("blake2b256", ref, "buffer").subarray(0, ITEM_ID_SIZE);
}
