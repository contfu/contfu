export type BasicAuthConfig = string;

const BASIC_AUTH_REALM = "Contfu";

export function isBasicAuthConfig(value: string | null | undefined): value is BasicAuthConfig {
  return typeof value === "string" && value.includes(":");
}

export function buildBasicAuthHeader(config: BasicAuthConfig): string {
  return `Basic ${Buffer.from(config).toString("base64")}`;
}

export function unauthorizedBasicAuthResponse(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${BASIC_AUTH_REALM}"`,
    },
  });
}

export function checkBasicAuth(request: Request, config: BasicAuthConfig | null): Response | null {
  if (!config) {
    return null;
  }

  return request.headers.get("authorization") === buildBasicAuthHeader(config)
    ? null
    : unauthorizedBasicAuthResponse();
}
