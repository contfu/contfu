import { describe, expect, it } from "bun:test";
import { decrypt, decryptString, deriveKey, encrypt, encryptString } from "./encryption";

describe("encryption", () => {
  const appSecret = "test-app-secret-that-should-be-long-enough";
  const userId = "user-123";

  describe("deriveKey", () => {
    it("should derive a 32-byte key", async () => {
      const key = await deriveKey(appSecret, userId);
      expect(key.length).toBe(32);
    });

    it("should derive the same key for same inputs", async () => {
      const key1 = await deriveKey(appSecret, userId);
      const key2 = await deriveKey(appSecret, userId);
      expect(key1.equals(key2)).toBe(true);
    });

    it("should derive different keys for different users", async () => {
      const key1 = await deriveKey(appSecret, "user-1");
      const key2 = await deriveKey(appSecret, "user-2");
      expect(key1.equals(key2)).toBe(false);
    });

    it("should derive different keys for different secrets", async () => {
      const key1 = await deriveKey("secret-1", userId);
      const key2 = await deriveKey("secret-2", userId);
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt data correctly", async () => {
      const key = await deriveKey(appSecret, userId);
      const originalData = Buffer.from("my-secret-api-token");

      const encrypted = encrypt(originalData, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted.equals(originalData)).toBe(true);
    });

    it("should produce different ciphertext for same plaintext (random IV)", async () => {
      const key = await deriveKey(appSecret, userId);
      const data = Buffer.from("same-data");

      const encrypted1 = encrypt(data, key);
      const encrypted2 = encrypt(data, key);

      // Ciphertexts should be different due to random IV
      expect(encrypted1.equals(encrypted2)).toBe(false);

      // But both should decrypt to the same value
      expect(decrypt(encrypted1, key).equals(data)).toBe(true);
      expect(decrypt(encrypted2, key).equals(data)).toBe(true);
    });

    it("should fail to decrypt with wrong key", async () => {
      const key1 = await deriveKey(appSecret, "user-1");
      const key2 = await deriveKey(appSecret, "user-2");
      const data = Buffer.from("secret");

      const encrypted = encrypt(data, key1);

      expect(() => decrypt(encrypted, key2)).toThrow();
    });

    it("should fail to decrypt tampered data", async () => {
      const key = await deriveKey(appSecret, userId);
      const data = Buffer.from("secret");

      const encrypted = encrypt(data, key);
      // Tamper with a byte in the middle (ciphertext portion)
      encrypted[15] ^= 0xff;

      expect(() => decrypt(encrypted, key)).toThrow();
    });

    it("should reject data that is too short", async () => {
      const key = await deriveKey(appSecret, userId);
      const tooShort = Buffer.alloc(20); // Less than IV + authTag

      expect(() => decrypt(tooShort, key)).toThrow("Invalid encrypted data: too short");
    });
  });

  describe("encryptString/decryptString", () => {
    it("should encrypt and decrypt strings correctly", async () => {
      const key = await deriveKey(appSecret, userId);
      const original = "my-api-token-with-special-chars-äöü-🔐";

      const encrypted = encryptString(original, key);
      const decrypted = decryptString(encrypted, key);

      expect(decrypted).toBe(original);
    });

    it("should handle empty strings", async () => {
      const key = await deriveKey(appSecret, userId);
      const encrypted = encryptString("", key);
      const decrypted = decryptString(encrypted, key);
      expect(decrypted).toBe("");
    });
  });
});
