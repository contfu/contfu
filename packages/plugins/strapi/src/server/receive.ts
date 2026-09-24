type Context = {
  request: { body?: unknown };
  state: { auth?: unknown };
  body?: unknown;
  badRequest(message: string): unknown;
};

type ReceiveStrapi = {
  auth: { verify(auth: unknown, config: { scope: string[] }): Promise<void> };
  contentType(uid: string):
    | {
        pluginOptions?: { i18n?: { localized?: boolean } };
        uid?: string;
        kind?: string;
        info?: unknown;
        options?: unknown;
        attributes?: Record<string, { type?: string; private?: boolean }>;
      }
    | undefined;
  db: { query(uid: string): { findMany(input: unknown): Promise<{ documentId?: unknown }[]> } };
  documents(uid: string): {
    unpublish(input: { documentId: string; locale: string }): Promise<unknown>;
  };
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Only API tokens are accepted; each request also checks permissions on the requested content type. */
export const receiveRoutes = {
  "content-api": {
    type: "content-api",
    routes: [
      {
        method: "POST",
        path: "/receive/schema",
        handler: "receive.schema",
        config: { auth: { strategies: ["api-token", "content-api-token"], scope: [] } },
      },
      {
        method: "POST",
        path: "/receive/resolve",
        handler: "receive.resolve",
        config: { auth: { strategies: ["api-token", "content-api-token"], scope: [] } },
      },
      {
        method: "POST",
        path: "/receive/unpublish",
        handler: "receive.unpublish",
        config: { auth: { strategies: ["api-token", "content-api-token"], scope: [] } },
      },
    ],
  },
};

export function receiveController({ strapi }: { strapi: ReceiveStrapi }) {
  async function authorize(ctx: Context, body: Record<string, unknown>, actions: string[]) {
    const uid = body.uid;
    if (typeof uid !== "string" || !/^api::[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(uid)) return null;
    await strapi.auth.verify(ctx.state.auth, {
      scope: actions.map((action) => `${uid}.${action}`),
    });
    const model = strapi.contentType(uid);
    if (!model?.pluginOptions?.i18n?.localized || typeof strapi.documents !== "function")
      return null;
    return { uid, model };
  }
  return {
    async schema(ctx: Context) {
      const body = record(ctx.request.body);
      if (!body) return ctx.badRequest("Invalid localized receive request");
      const authorized = await authorize(ctx, body, ["find", "update"]);
      if (!authorized) return ctx.badRequest("Localized Strapi v5 collection required");
      const model = authorized.model;
      ctx.body = {
        uid: authorized.uid,
        kind: model.kind,
        info: model.info,
        options: model.options,
        pluginOptions: model.pluginOptions,
        attributes: Object.fromEntries(
          Object.entries(model.attributes ?? {}).filter(
            ([name, attr]) =>
              !attr.private &&
              ![
                "id",
                "documentId",
                "locale",
                "createdAt",
                "updatedAt",
                "publishedAt",
                "createdBy",
                "updatedBy",
                "localizations",
              ].includes(name),
          ),
        ),
      };
    },
    async resolve(ctx: Context) {
      const body = record(ctx.request.body);
      if (!body) return ctx.badRequest("Invalid localized receive request");
      const authorized = await authorize(ctx, body, ["find"]);
      const key = body.key;
      const value = body.value;
      if (
        !authorized ||
        typeof key !== "string" ||
        !Object.hasOwn(authorized.model.attributes ?? {}, key) ||
        authorized.model.attributes?.[key]?.private === true ||
        !["string", "text", "uid", "email", "integer", "biginteger", "float", "decimal"].includes(
          authorized.model.attributes?.[key]?.type ?? "",
        ) ||
        !(
          (typeof value === "string" && value.length > 0) ||
          (typeof value === "number" && Number.isFinite(value))
        )
      ) {
        return ctx.badRequest("Invalid localized grouping key");
      }
      // Query all authored locales and both publication states, not the REST default locale.
      const rows = await strapi.db
        .query(authorized.uid)
        .findMany({ where: { [key]: { $eq: value } }, select: ["documentId"], limit: 1001 });
      if (rows.length > 1000 || rows.some((row) => typeof row.documentId !== "string"))
        return ctx.badRequest("Ambiguous localized document lookup");
      ctx.body = { documentIds: [...new Set(rows.map((row) => row.documentId))] };
    },
    async unpublish(ctx: Context) {
      const body = record(ctx.request.body);
      if (!body) return ctx.badRequest("Invalid localized receive request");
      const authorized = await authorize(ctx, body, ["update"]);
      if (
        !authorized ||
        record(authorized.model.options)?.draftAndPublish !== true ||
        typeof body.documentId !== "string" ||
        !/^[a-zA-Z0-9_-]{1,256}$/.test(body.documentId) ||
        typeof body.locale !== "string" ||
        !/^[a-zA-Z0-9_-]{1,256}$/.test(body.locale)
      )
        return ctx.badRequest("Invalid localized document identity");
      await strapi
        .documents(authorized.uid)
        .unpublish({ documentId: body.documentId, locale: body.locale });
      ctx.body = { ok: true };
    },
  };
}
