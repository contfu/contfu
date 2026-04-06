import { getApiClient, handleApiError } from "../http";

export async function discover(connectionId: string): Promise<void> {
  const client = getApiClient();
  try {
    const result = await client.discoverCollections(connectionId);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    handleApiError(err);
  }
}
