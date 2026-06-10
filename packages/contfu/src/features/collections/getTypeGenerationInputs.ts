import type { TypeGenerationInput } from "@contfu/core";
import { db } from "../../infra/db/db";
import { collectionsTable } from "../../infra/db/schema";

export function getTypeGenerationInputs(ctx = db): TypeGenerationInput[] {
  return ctx
    .select({
      name: collectionsTable.name,
      displayName: collectionsTable.displayName,
      schema: collectionsTable.schema,
      i18n: collectionsTable.i18n,
    })
    .from(collectionsTable)
    .all()
    .map((row) => ({ ...row, i18n: row.i18n ?? undefined }));
}
