import { afterEach, describe, expect, it } from "bun:test";
import { clearKeyCache, decryptCredentials, encryptCredentials } from "./credentials";

describe("credentials", () => {
  const originalSecret = process.env.BETTER_AUTH_SECRET;

  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = originalSecret;
    clearKeyCache();
  });

  it("decrypts encrypted credentials", async () => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long";
    const plain = Buffer.from("secret-token", "utf8");

    const encrypted = await encryptCredentials(1, plain);
    const decrypted = await decryptCredentials(1, encrypted);

    expect(decrypted?.equals(plain)).toBe(true);
  });

  it("rejects plaintext credentials", async () => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long";
    const plain = Buffer.from("legacy-token", "utf8");

    await expect(decryptCredentials(1, plain)).rejects.toThrow("Invalid encrypted data: too short");
  });

  it("rejects credentials encrypted with a different app secret", async () => {
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long";
    const encrypted = await encryptCredentials(1, Buffer.from("secret-token", "utf8"));

    process.env.BETTER_AUTH_SECRET = "different-secret-at-least-32-chars";
    clearKeyCache(1);

    await expect(decryptCredentials(1, encrypted)).rejects.toThrow(
      "Unsupported state or unable to authenticate data",
    );
  });
});
