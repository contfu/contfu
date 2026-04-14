import { parseArgs } from "node:util";

async function clientFetch(clientUrl: string, path: string): Promise<Response> {
  const url = `${clientUrl}${path}`;
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
  const { values } = parseArgs({
    args,
    options: {
      "client-url": { type: "string", short: "u" },
      collection: { type: "string" },
      filter: { type: "string" },
      sort: { type: "string" },
      limit: { type: "string", default: "20" },
      offset: { type: "string", default: "0" },
      include: { type: "string" },
      fields: { type: "string" },
      flat: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const clientUrl = values["client-url"];
  if (!clientUrl) {
    console.error("Missing required --client-url flag");
    process.exit(1);
  }

  const basePath = values.collection ? `/api/collections/${values.collection}/items` : "/api/items";

  const qs = buildQueryString({
    filter: values.filter,
    sort: values.sort,
    limit: values.limit,
    offset: values.offset,
    include: values.include,
    fields: values.fields,
    flat: values.flat ? "true" : undefined,
  });

  const res = await clientFetch(clientUrl, `${basePath}${qs}`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function countItems(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      "client-url": { type: "string", short: "u" },
      collection: { type: "string" },
      filter: { type: "string" },
    },
    allowPositionals: true,
  });

  const clientUrl = values["client-url"];
  if (!clientUrl) {
    console.error("Missing required --client-url flag");
    process.exit(1);
  }

  const basePath = values.collection ? `/api/collections/${values.collection}/items` : "/api/items";

  const qs = buildQueryString({
    filter: values.filter,
    limit: "0",
  });

  const res = await clientFetch(clientUrl, `${basePath}${qs}`);
  const data = await res.json();
  console.log(data?.meta?.total ?? 0);
}
