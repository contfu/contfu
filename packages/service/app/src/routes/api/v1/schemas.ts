import { error } from "@sveltejs/kit";
import * as v from "valibot";

export {
  CreateSourceSchema,
  UpdateSourceSchema,
  CreateCollectionSchema,
  UpdateCollectionSchema,
  CreateConsumerSchema,
  UpdateConsumerSchema,
  CreateConnectionSchema,
  UpdateConnectionSchema,
  CreateInfluxSchema,
  UpdateInfluxSchema,
} from "@contfu/svc-core";

export function parseBody<T>(schema: v.GenericSchema<T>, data: unknown): T {
  const result = v.safeParse(schema, data);
  if (!result.success) {
    const issues = result.issues.map((i) => i.message).join("; ");
    error(400, `Invalid request body: ${issues}`);
  }
  return result.output;
}
