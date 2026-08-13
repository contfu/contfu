import {
  checkBasicAuth as checkBasicAuthRequest,
  isBasicAuthConfig,
  type BasicAuthConfig,
} from "@contfu/core";

export type { BasicAuthConfig };

export const basicAuth = isBasicAuthConfig(process.env.CONTFU_BASIC_AUTH)
  ? process.env.CONTFU_BASIC_AUTH
  : null;

export function checkBasicAuth(
  request: Request,
  config: BasicAuthConfig | null = basicAuth,
): Response | null {
  return checkBasicAuthRequest(request, config);
}
