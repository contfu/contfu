export function encodeId(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function decodeId(id: string): Buffer {
  return Buffer.from(id, "base64url");
}
