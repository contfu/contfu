import { generateConsumerTypes, type TypeGenerationInput } from "@contfu/svc-api";
import { getApiClient, handleApiError } from "../http";

export async function connectionTypes(id: string) {
  const client = getApiClient();
  let collections: TypeGenerationInput[];
  try {
    collections = await client.getConnectionTypes(id);
  } catch (err) {
    handleApiError(err);
  }

  if (collections.length === 0) {
    console.error("No collections connected to this connection");
    process.exit(1);
  }

  process.stdout.write(generateConsumerTypes(collections));
}

export async function collectionTypes(id: string) {
  const client = getApiClient();
  let collections: TypeGenerationInput[];
  try {
    collections = await client.getCollectionTypes(id);
  } catch (err) {
    handleApiError(err);
  }

  if (collections.length === 0) {
    console.error("No types found for this collection");
    process.exit(1);
  }

  process.stdout.write(generateConsumerTypes(collections));
}
