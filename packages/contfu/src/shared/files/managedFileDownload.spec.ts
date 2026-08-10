import { afterEach, describe, expect, mock, test } from "bun:test";
import { downloadFile } from "./managedFileDownload";

describe("downloadFile", () => {
  const originalFetch = globalThis.fetch;
  const key = Buffer.alloc(32, 7);

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  test("sends the application key to a managed file URL and strips it on a provider redirect", async () => {
    const calls: Array<{
      url: string;
      authorization: string | null;
      redirect?: RequestInit["redirect"];
    }> = [];
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      calls.push({
        url,
        authorization: new Headers(init?.headers).get("authorization"),
        redirect: init?.redirect,
      });
      if (url === "https://cloud.example/api/files/1") {
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { Location: "https://provider.example/file.png" },
          }),
        );
      }
      return Promise.resolve(new Response("image", { headers: { "Content-Type": "image/png" } }));
    }) as unknown as typeof fetch;

    const response = await downloadFile("https://cloud.example/api/files/1", {
      applicationKey: key,
      contfuOrigin: "https://cloud.example",
    });

    expect(await response.text()).toBe("image");
    expect(calls).toEqual([
      {
        url: "https://cloud.example/api/files/1",
        authorization: `Bearer ${key.toString("base64url")}`,
        redirect: "manual",
      },
      {
        url: "https://provider.example/file.png",
        authorization: null,
        redirect: "manual",
      },
    ]);
  });

  test("keeps external and non-file Contfu URLs unauthenticated", async () => {
    const authorizations: string[] = [];
    globalThis.fetch = mock((_url: string, init?: RequestInit) => {
      authorizations.push(new Headers(init?.headers).get("authorization") ?? "");
      return Promise.resolve(new Response("ok"));
    }) as unknown as typeof fetch;

    await downloadFile("https://provider.example/image.png", {
      applicationKey: key,
      contfuOrigin: "https://cloud.example",
    });
    await downloadFile("https://cloud.example/api/files-not/1", {
      applicationKey: key,
      contfuOrigin: "https://cloud.example",
    });
    await downloadFile("https://cloud.example.evil/api/files/1", {
      applicationKey: key,
      contfuOrigin: "https://cloud.example",
    });

    expect(authorizations).toEqual(["", "", ""]);
  });
});
