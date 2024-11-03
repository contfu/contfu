import { createHash } from "crypto";

export function hashId(str: string): string {
  const hasher = createHash("sha1");
  hasher.update(str);
  return hasher.digest("hex").slice(0, 32);
}
