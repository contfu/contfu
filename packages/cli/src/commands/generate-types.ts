import { apiFetch } from "../http";
import { generateTypeScript, generateConsumerTypes, type TypeGenerationInput } from "@contfu/core";

export async function collectionTypes(target: string) {
  let collection: TypeGenerationInput;

  const collectionId = Number(target);
  if (!Number.isNaN(collectionId)) {
    const res = await apiFetch(`/api/v1/collections/${collectionId}`);
    collection = await res.json();
  } else {
    const res = await apiFetch("/api/v1/collections");
    const all = await res.json();
    const match = all.find((c: { name: string }) => c.name === target);
    if (!match) {
      console.error(`Collection "${target}" not found`);
      process.exit(1);
    }
    collection = match;
  }

  process.stdout.write(generateTypeScript([collection]));
}

export async function consumerTypes(id: string) {
  const res = await apiFetch(`/api/v1/consumers/${id}/collections`);
  const collections: TypeGenerationInput[] = await res.json();

  if (collections.length === 0) {
    console.error("No collections connected to this consumer");
    process.exit(1);
  }

  process.stdout.write(generateConsumerTypes(collections));
}
