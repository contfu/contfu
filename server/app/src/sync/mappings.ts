export function refFromUuid(uuid: string) {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

export function idFromRef(ref: Buffer) {
  const buf = ref.subarray(12);
  return buf.readUInt32LE(0) & 0x7fffffff;
}

export function camelCase(str: string) {
  let result = "";
  let capitalizeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (/[-_\s]/.test(char)) {
      capitalizeNext = true;
    } else {
      if (capitalizeNext) {
        result += char.toUpperCase();
        capitalizeNext = false;
      } else if (i === 0) {
        result += char.toLowerCase();
      } else {
        result += char;
      }
    }
  }
  return result;
}
