import { parseArgs } from "node:util";
import { CliParseError } from "../cli-args";

async function serverFetch(serverUrl: string, path: string): Promise<Response> {
  const url = `${serverUrl}${path}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    console.error(`Error ${res.status}: ${text}`);
    process.exit(1);
  }

  return res;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "",
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

export async function queryItems(args: string[]) {
  let values;
  try {
    ({ values } = parseArgs({
      args,
      options: {
        "client-url": { type: "string", short: "u" },
        collection: { type: "string" },
        filter: { type: "string" },
        search: { type: "string" },
        sort: { type: "string" },
        limit: { type: "string", default: "20" },
        offset: { type: "string", default: "0" },
        include: { type: "string" },
        fields: { type: "string" },
        locale: { type: "string" },
        fallback: { type: "string" },
        flat: { type: "boolean", default: false },
      },
      allowPositionals: true,
    }));
  } catch {
    throw new CliParseError();
  }

  const serverUrl = values["client-url"] ?? process.env.CONTFU_SERVER_URL;
  if (!serverUrl) {
    console.error("Missing required --client-url flag or CONTFU_SERVER_URL");
    process.exit(1);
  }

  const basePath = values.collection ? `/api/collections/${values.collection}/items` : "/api/items";

  const qs = buildQueryString({
    filter: values.filter,
    search: values.search,
    sort: values.sort,
    limit: values.limit,
    offset: values.offset,
    include: values.include,
    fields: values.fields,
    locale: values.locale,
    fallback: values.fallback,
    flat: values.flat ? "true" : undefined,
  });

  const res = await serverFetch(serverUrl, `${basePath}${qs}`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function countItems(args: string[]) {
  let values;
  try {
    ({ values } = parseArgs({
      args,
      options: {
        "client-url": { type: "string", short: "u" },
        collection: { type: "string" },
        filter: { type: "string" },
        search: { type: "string" },
        locale: { type: "string" },
        fallback: { type: "string" },
      },
      allowPositionals: true,
    }));
  } catch {
    throw new CliParseError();
  }

  const serverUrl = values["client-url"] ?? process.env.CONTFU_SERVER_URL;
  if (!serverUrl) {
    console.error("Missing required --client-url flag or CONTFU_SERVER_URL");
    process.exit(1);
  }

  const basePath = values.collection ? `/api/collections/${values.collection}/items` : "/api/items";

  const qs = buildQueryString({
    filter: values.filter,
    search: values.search,
    locale: values.locale,
    fallback: values.fallback,
    limit: "0",
  });

  const res = await serverFetch(serverUrl, `${basePath}${qs}`);
  const data = (await res.json()) as { meta?: { total?: number } };
  console.log(data.meta?.total ?? 0);
}
