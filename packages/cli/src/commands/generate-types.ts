import { generateApplicationConnectionTypes, type TypeGenerationInput } from "@contfu/svc-api";
import { getApiClient, handleCliError } from "../http";
import { resolveCollectionRef, resolveConnectionRef } from "./resources";

export async function connectionTypes(id: string) {
  const client = getApiClient();
  let collections: TypeGenerationInput[];
  try {
    const resolvedId = await resolveConnectionRef(id, client);
    collections = await client.getConnectionTypes(resolvedId);
  } catch (err) {
    handleCliError(err);
  }

  if (collections.length === 0) {
    console.error("No collections connected to this connection");
    process.exit(1);
  }

  process.stdout.write(generateApplicationConnectionTypes(collections));
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

  process.stdout.write(generateApplicationConnectionTypes(collections));
}
