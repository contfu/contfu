export type BasicAuthConfig = string;

const BASIC_AUTH_REALM = "Contfu";

export const basicAuth = process.env.CONTFU_BASIC_AUTH?.includes(":")
  ? process.env.CONTFU_BASIC_AUTH
  : null;

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

export function checkBasicAuth(
  request: Request,
  config: BasicAuthConfig | null = basicAuth,
): Response | null {
  if (!config) {
    return null;
  }

  return request.headers.get("authorization") === buildBasicAuthHeader(config)
    ? null
    : unauthorizedBasicAuthResponse();
}
