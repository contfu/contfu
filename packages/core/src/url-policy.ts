/**
 * URL schemes permitted by the default rich-content string renderers.
 *
 * Relative references have no scheme and are allowed separately by
 * `isSafeUrl`. Custom renderers are responsible for their own policy.
 */
export const SAFE_URL_SCHEMES = ["http", "https", "mailto", "tel"] as const;

const schemePattern = /^([a-z][a-z\d+.-]*):/;
const unsafeDestinationPattern = /[\s\\()[\]<>]/u;

function normalizeForSchemeInspection(href: string): string {
  let normalized = "";
  for (const char of href) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (/\s/u.test(char) || codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      continue;
    }
    normalized += char.toLowerCase();
  }
  return normalized;
}

/**
 * Return whether an href is safe for the default rich-content renderers.
 *
 * The original href is deliberately not rewritten. Whitespace and control
 * characters are removed only while inspecting the scheme, matching the
 * browser's URL normalization closely enough to catch obfuscated schemes.
 * References without a scheme are relative URLs and are allowed.
 */
export function isSafeUrl(href: string): boolean {
  const normalized = normalizeForSchemeInspection(href);
  const match = schemePattern.exec(normalized);
  if (!match) return true;
  return (SAFE_URL_SCHEMES as readonly string[]).includes(match[1]);
}

/**
 * Return whether an href is safe for the default HTML and Markdown renderers.
 *
 * In addition to the URL scheme policy, reject characters that can escape a
 * Markdown destination or be normalized unexpectedly by a browser URL sink.
 */
export function isSafeRichContentUrl(href: string): boolean {
  if (!isSafeUrl(href) || unsafeDestinationPattern.test(href)) return false;
  for (const char of href) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return false;
  }
  return true;
}
