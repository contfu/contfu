import { apiFetch } from "../http";

export interface StatusSummary {
  sources: number;
  collections: number;
  consumers: number;
  connections: number;
}

export async function status(format = "table") {
  const res = await apiFetch("/api/v1/status");
  const data = (await res.json()) as StatusSummary;

  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log("contfu status");
  console.log("-------------");
  console.log(`sources      ${data.sources}`);
  console.log(`collections  ${data.collections}`);
  console.log(`consumers    ${data.consumers}`);
  console.log(`connections  ${data.connections}`);
}
