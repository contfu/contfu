import { describe, expect, it, mock } from "bun:test";
import { receiveController, receiveRoutes } from "./receive";

function fixture() {
  const verify = mock((_auth: unknown, _config: { scope: string[] }) => Promise.resolve());
  const unpublish = mock((_input: unknown) => Promise.resolve({}));
  const findMany = mock((_input: unknown): Promise<{ documentId: unknown }[]> =>
    Promise.resolve([{ documentId: "doc1" }, { documentId: "doc1" }]),
  );
  const controller = receiveController({
    strapi: {
      auth: { verify },
      contentType: () => ({
        kind: "collectionType",
        options: { draftAndPublish: true },
        pluginOptions: { i18n: { localized: true } },
        attributes: { title: { type: "string" }, secret: { type: "string", private: true } },
      }),
      db: { query: () => ({ findMany }) },
      documents: () => ({ unpublish }),
    },
  });
  const context = (body: unknown) => ({
    request: { body },
    state: { auth: { token: "opaque" } },
    body: undefined as unknown,
    badRequest: (message: string) => {
      throw new Error(message);
    },
  });
  return { verify, unpublish, findMany, controller, context };
}

describe("Strapi localized receive plugin", () => {
  it("accepts only token strategies, never unauthenticated or user-session routes", () => {
    for (const route of receiveRoutes["content-api"].routes)
      expect(route.config.auth.strategies).toEqual(["api-token", "content-api-token"]);
  });
  it("checks per-content-type update permission before native unpublish and passes one locale", async () => {
    const f = fixture();
    await f.controller.unpublish(
      f.context({ uid: "api::article.article", documentId: "doc1", locale: "de" }),
    );
    expect(f.verify).toHaveBeenCalledWith(
      { token: "opaque" },
      { scope: ["api::article.article.update"] },
    );
    expect(f.unpublish).toHaveBeenCalledWith({ documentId: "doc1", locale: "de" });
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      f.controller.unpublish(
        f.context({ uid: "api::article.article", documentId: "doc1", locale: "*" }),
      ),
    ).rejects.toThrow("Invalid");
    expect(f.unpublish).toHaveBeenCalledTimes(1);
  });
  it("does not execute a mutation after failed authorization", async () => {
    const f = fixture();
    f.verify.mockImplementation(() => Promise.reject(new Error("Forbidden")));
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      f.controller.unpublish(
        f.context({ uid: "api::article.article", documentId: "doc1", locale: "en" }),
      ),
    ).rejects.toThrow("Forbidden");
    expect(f.unpublish).not.toHaveBeenCalled();
  });
  it("does not expose private or internal fields and requires find/update schema permissions", async () => {
    const f = fixture();
    const ctx = f.context({ uid: "api::article.article" });
    await f.controller.schema(ctx);
    expect(ctx.body).toMatchObject({ attributes: { title: { type: "string" } } });
    expect((ctx.body as { attributes: object }).attributes).not.toHaveProperty("secret");
    expect(f.verify).toHaveBeenCalledWith(
      { token: "opaque" },
      { scope: ["api::article.article.find", "api::article.article.update"] },
    );
  });
  it("rejects private grouping fields rather than allowing secret-value probes", async () => {
    const f = fixture();
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      f.controller.resolve(
        f.context({ uid: "api::article.article", key: "secret", value: "guess" }),
      ),
    ).rejects.toThrow("Invalid");
    expect(f.findMany).not.toHaveBeenCalled();
  });

  it("deduplicates authored locale/status rows and bounds lookup", async () => {
    const f = fixture();
    const ctx = f.context({ uid: "api::article.article", key: "title", value: "shared" });
    await f.controller.resolve(ctx);
    expect(ctx.body).toEqual({ documentIds: ["doc1"] });
    expect(f.findMany).toHaveBeenCalledWith({
      where: { title: { $eq: "shared" } },
      select: ["documentId"],
      limit: 1001,
    });
    f.findMany.mockImplementation(() =>
      Promise.resolve(Array.from({ length: 1001 }, () => ({ documentId: "doc1" }))),
    );
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(f.controller.resolve(ctx)).rejects.toThrow("Ambiguous");
  });
});
