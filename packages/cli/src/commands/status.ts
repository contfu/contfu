import { apiFetch } from "../http";

export interface StatusSummary {
  connections: number;
  collections: number;
  flows: number;
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
  console.log(`connections  ${data.connections}`);
  console.log(`collections  ${data.collections}`);
  console.log(`flows        ${data.flows}`);
}
