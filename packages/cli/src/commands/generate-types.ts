import { apiFetch } from "../http";
import { generateConsumerTypes, type TypeGenerationInput } from "@contfu/core";

export async function consumerTypes(id: string) {
  const res = await apiFetch(`/api/v1/consumers/${id}/collections`);
  const collections: TypeGenerationInput[] = await res.json();

  if (collections.length === 0) {
    console.error("No collections connected to this consumer");
    process.exit(1);
  }

  process.stdout.write(generateConsumerTypes(collections));
}
