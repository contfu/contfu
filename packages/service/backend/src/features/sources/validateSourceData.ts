import { SourceType } from "@contfu/core";
import { WebAuthType } from "@contfu/svc-core";

/**
 * Validation errors
 */
export type ValidationError = {
  field?: string;
  message: string;
};

/**
 * Validate source data based on type.
 */
export function validateSourceData(
  type: SourceType,
  url: string | null | undefined,
  credentials: string,
  authType?: WebAuthType,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (type === SourceType.STRAPI || type === SourceType.WEB) {
    if (!url) {
      const sourceLabel = type === SourceType.STRAPI ? "Strapi" : "Web";
      errors.push({ field: "url", message: `URL is required for ${sourceLabel} sources` });
    } else {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.push({ field: "url", message: "URL must use http or https protocol" });
        }
      } catch {
        errors.push({ field: "url", message: "Invalid URL format" });
      }
    }
  }

  // Credentials are required for Notion and Strapi, but optional for Web sources when authType is NONE
  const credentialsOptional =
    type === SourceType.WEB && (authType === WebAuthType.NONE || authType === undefined);

  if (!credentialsOptional && (!credentials || credentials.trim().length === 0)) {
    errors.push({ field: "credentials", message: "API token is required" });
  }

  return errors;
}
