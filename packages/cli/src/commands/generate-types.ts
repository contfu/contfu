import { apiFetch } from "../http";
import { generateConsumerTypes, type TypeGenerationInput } from "@contfu/core";

export async function connectionTypes(id: string) {
  const res = await apiFetch(`/api/v1/connections/${id}/types`);
  const collections: TypeGenerationInput[] = await res.json();

  if (collections.length === 0) {
    console.error("No collections connected to this connection");
    process.exit(1);
  }

  process.stdout.write(generateConsumerTypes(collections));
}
