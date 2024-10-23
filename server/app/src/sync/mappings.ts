export function idFromUuid(uuid: string) {
  return Buffer.from(uuid.replace(/-/g, ""), "hex").toString("base64url");
}
