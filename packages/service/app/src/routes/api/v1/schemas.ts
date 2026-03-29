import { error } from "@sveltejs/kit";
import * as v from "valibot";

export {
  CreateConnectionSchema,
  UpdateConnectionSchema,
  CreateCollectionSchema,
  UpdateCollectionSchema,
  CreateFlowSchema,
  UpdateFlowSchema,
} from "@contfu/svc-backend/domain/api-schemas";

export function parseBody<T>(schema: v.GenericSchema<T>, data: unknown): T {
  const result = v.safeParse(schema, data);
  if (!result.success) {
    const issues = result.issues.map((i) => i.message).join("; ");
    error(400, `Invalid request body: ${issues}`);
  }
  return result.output;
}
