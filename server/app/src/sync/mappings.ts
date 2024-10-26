import { hash } from "crypto";

export function refFromUuid(uuid: string) {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/**
 * Calculates the id from a reference.
 * We use 12 byte hashes for item ids.
 * The collision probability is sufficiently low for our use case:
 *
 * | Samples    | 8 bytes    | 12 bytes  | 16 bytes  |
 * |------------|------------|-----------|-----------|
 * | 1,000      | 2.71e-9%   | 2.71e-21% | 2.71e-33% |
 * | 10,000     | 2.71e-7%   | 2.71e-19% | 2.71e-31% |
 * | 100,000    | 0.0000271% | 2.71e-17% | 2.71e-29% |
 * | 1,000,000  | 0.00271%   | 2.71e-15% | 2.71e-27% |
 * | 10,000,000 | 0.271%     | 2.71e-13% | 2.71e-25% |
 *
 * We use blake2b256, since it's fast and has a good collision resistance.
 */
export function idFromRef(ref: Buffer) {
  return hash("blake2b256", ref, "buffer").subarray(0, 12);
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
