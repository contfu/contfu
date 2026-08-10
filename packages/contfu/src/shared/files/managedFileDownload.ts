const MAX_REDIRECTS = 10;

export type ManagedFileDownloadOptions = {
  applicationKey?: Buffer;
  contfuOrigin?: string;
};

function managedFileUrl(url: string, contfuOrigin?: string): boolean {
  if (!contfuOrigin) return false;
  try {
    const candidate = new URL(url);
    return (
      candidate.origin === new URL(contfuOrigin).origin &&
      candidate.pathname.startsWith("/api/files/")
    );
  } catch {
    return false;
  }
}

/**
 * Download a file, authenticating only Contfu's stable managed-file endpoint.
 * Redirects are followed manually so the application credential is never sent
 * to a provider origin.
 */
export async function downloadFile(
  sourceUrl: string,
  options: ManagedFileDownloadOptions,
): Promise<Response> {
  let url = sourceUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const headers = new Headers();
    if (managedFileUrl(url, options.contfuOrigin) && options.applicationKey) {
      headers.set("Authorization", `Bearer ${options.applicationKey.toString("base64url")}`);
    }
    const response = await fetch(url, {
      ...(headers.has("Authorization") ? { headers } : {}),
      redirect: "manual",
    });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) throw new Error("File redirect response is missing Location");
    url = new URL(location, url).toString();
  }
  throw new Error("File download exceeded the redirect limit");
}
