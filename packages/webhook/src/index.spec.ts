import { describe, expect, mock, test } from "bun:test";
import { ContfuWebhookError, createWebhookClient, serializePayload, signPayload } from "./index";

describe("@contfu/webhook", () => {
  test("serializes and signs the canonical delete vector", async () => {
    const body = JSON.stringify({
      version: 1,
      operation: "delete",
      collectionRef: "articles",
      itemRef: "article-42",
      sequence: 1,
    });
    expect(
      serializePayload({
        operation: "delete",
        collectionRef: "articles",
        itemRef: "article-42",
        sequence: 1,
      }),
    ).toBe(body);
    const signature = await Promise.resolve(signPayload(body, "test-secret"));
    expect(signature).toBe(
      "sha256=1b8f6e8905eea271775c6db62ad210f3466961710497473a89e0b08ffcd0d3c9",
    );
  });

  test("sends exact body, signature, and media type", async () => {
    const fetch = mock(async (_input: string | URL, _init?: RequestInit) => {
      await Promise.resolve();
      return new Response("OK", { status: 200, headers: { "content-type": "text/plain" } });
    });
    const client = createWebhookClient({
      endpoint: "https://contfu.test/webhooks/contfu/push-uid",
      secret: "test-secret",
      fetch,
    });
    await client.push({
      operation: "update",
      collectionRef: "articles",
      itemRef: "https://example.com/article-42",
      sequence: 4,
      properties: { title: "Hello" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const call = fetch.mock.calls.at(0);
    if (!call) throw new Error("fetch was not called");
    const [url, init] = call;
    expect(url).toBe("https://contfu.test/webhooks/contfu/push-uid");
    if (!init) throw new Error("fetch init was not provided");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        version: 1,
        operation: "update",
        collectionRef: "articles",
        itemRef: "https://example.com/article-42",
        sequence: 4,
        properties: { title: "Hello" },
      }),
    );
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect((init.headers as Record<string, string>)["x-contfu-signature"]).toMatch(
      /^sha256=[0-9a-f]{64}$/,
    );
  });

  test("sends the exact canonical bootstrap body", async () => {
    const fetch = mock(() => new Response("OK", { status: 200 }));
    const client = createWebhookClient({
      endpoint: "https://contfu.test/webhooks/contfu/push-uid",
      secret: "test-secret",
      fetch,
    });

    await client.bootstrap();

    const call = fetch.mock.calls.at(0);
    if (!call) throw new Error("fetch was not called");
    const [, init] = call;
    if (!init) throw new Error("fetch init was not provided");
    expect(init.body).toBe(JSON.stringify({ version: 1, event: "contfu.plugin.enabled" }));
    expect((init.headers as Record<string, string>)["x-contfu-signature"]).toBe(
      "sha256=180a6741e53cb32992a2e8e37bb8ed2200d951a47a84bca720563247f2718735",
    );
  });

  test("reports rejected responses with status and body", async () => {
    const fetch = mock(async () => {
      await Promise.resolve();
      return new Response("Unauthorized", { status: 401 });
    });
    const client = createWebhookClient({
      endpoint: "https://contfu.test/push",
      secret: "secret",
      fetch,
    });
    try {
      await client.push({ operation: "delete", collectionRef: "a", itemRef: "b", sequence: 1 });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ContfuWebhookError);
      expect(error).toMatchObject({ status: 401, body: "Unauthorized" });
    }
  });
});
