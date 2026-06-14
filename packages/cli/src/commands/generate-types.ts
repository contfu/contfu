import { generateApplicationIntegrationTypes, type TypeGenerationInput } from "@contfu/svc-api";
import { getApiClient, handleCliError } from "../http";
import { resolveCollectionRef, resolveIntegrationRef } from "./resources";

export async function integrationTypes(id: string) {
  const client = getApiClient();
  let collections: TypeGenerationInput[];
  try {
    const resolvedId = await resolveIntegrationRef(id, client);
    collections = await client.getIntegrationTypes(resolvedId);
  } catch (err) {
    handleCliError(err);
  }

  if (collections.length === 0) {
    console.error("No collections connected to this integration");
    process.exit(1);
  }

  process.stdout.write(generateApplicationIntegrationTypes(collections));
}

export async function collectionTypes(id: string) {
  const client = getApiClient();
  let collections: TypeGenerationInput[];
  try {
    const resolvedId = await resolveCollectionRef(id, client);
    collections = await client.getCollectionTypes(resolvedId);
  } catch (err) {
    handleCliError(err);
  }

  if (collections.length === 0) {
    console.error("No types found for this collection");
    process.exit(1);
  }

  process.stdout.write(generateApplicationIntegrationTypes(collections));
}
