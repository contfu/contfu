import { describe, expect, test } from "bun:test";
import { buildBasicAuthHeader, checkBasicAuth, isBasicAuthConfig } from "./basic-auth";

describe("basic auth helpers", () => {
  test("recognizes configured username/password pairs", () => {
    expect(isBasicAuthConfig("admin:secret")).toBe(true);
    expect(isBasicAuthConfig("admin")).toBe(false);
    expect(isBasicAuthConfig(undefined)).toBe(false);
  });

  test("allows requests with matching credentials", () => {
    const response = checkBasicAuth(
      new Request("http://localhost", {
        headers: { authorization: buildBasicAuthHeader("admin:secret") },
      }),
      "admin:secret",
    );

    expect(response).toBeNull();
  });

  test("rejects requests without matching credentials", async () => {
    const response = checkBasicAuth(new Request("http://localhost"), "admin:secret");

    expect(response?.status).toBe(401);
    expect(response?.headers.get("WWW-Authenticate")).toBe('Basic realm="Contfu"');
    expect(await response?.text()).toBe("Unauthorized");
  });
});
