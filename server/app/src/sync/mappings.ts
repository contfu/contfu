export function refFromUuid(uuid: string) {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

export function idFromRef(ref: Buffer) {
  const buf = ref.subarray(12);
  return buf.readUInt32LE(0) & 0x7fffffff;
}
