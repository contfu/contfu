import type { ApiStatus } from "@contfu/svc-api";
import { getApiClient, handleApiError } from "../http";

export async function status(format = "table") {
  const client = getApiClient();
  let data: ApiStatus;
  try {
    data = await client.getStatus();
  } catch (err) {
    handleApiError(err);
  }

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
