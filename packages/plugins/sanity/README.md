# @contfu/sanity

Post your Sanity Studio schema to Contfu so Contfu can use the Studio schema as the authoritative collection schema instead of sampling Content Lake documents. Collections without a pushed Studio schema use item-derived sampling until a push arrives.

## Install

```bash
bun add @contfu/sanity
```

`@contfu/sanity` consumes your Studio `schemaTypes` array without importing Sanity at runtime.

## Usage

Given a Sanity Studio schema setup like this:

```ts
// schemaTypes/postType.ts
import { defineField, defineType } from "sanity";

export const postType = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string" }),
    defineField({ name: "slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "publishedAt", type: "datetime" }),
    defineField({ name: "image", type: "image" }),
    defineField({ name: "body", type: "array", of: [{ type: "block" }] }),
  ],
});
```

```ts
// schemaTypes/index.ts
import { postType } from "./postType";

export const schemaTypes = [postType];
```

Call `updateContfuSchema` from `sanity.cli.ts` so the schema sync runs server-side when the Sanity CLI starts:

```ts
import { updateContfuSchema } from "@contfu/sanity";
import { defineCliConfig } from "sanity/cli";
import { schemaTypes } from "./schemaTypes";

await updateContfuSchema({
  webhookSecret: process.env.CONTFU_SANITY_WEBHOOK_SECRET!,
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  schemaTypes,
  onDiagnostic: (diagnostic) => console.warn(diagnostic),
});

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
});
```

## Normalized schema boundary

The push maps Sanity strings, numbers, booleans, dates/datetimes, geopoints,
colors, references, assets, Portable Text blocks, objects, and homogeneous
arrays of supported members to Contfu property types. Named schema aliases are
resolved through their definitions. Unresolved types, arrays with mixed Contfu
member types, and arrays whose members have no compatible Contfu array type are
omitted rather than guessed. Contfu arrays cover strings, numbers, references,
and assets; object and Portable Text block members keep their existing generic
Contfu representations. Boolean, date, color, and geopoint arrays have no
corresponding Contfu array type and are omitted.
Reference destinations are published as Contfu reference-target metadata, including
`crossDatasetReference` destinations in other projects and datasets, and dataset
`globalDocumentReference` destinations. Foreign projects remain connection-qualified
until a matching Sanity integration is connected in the same workspace. Pass the
source `projectId` to keep explicit same-project destinations local.

Only a reliably evaluated `.required()` on a document field changes Contfu
optionality. Sanity minimum/maximum, custom, unknown, throwing, or asynchronous
validation is not enforced by Contfu and is reported as a structured diagnostic.
Member validation and nested object field validation are also diagnosed because
the normalized collection schema is flat. Studio-only `hidden`, `readOnly`, and
custom input components are diagnosed but never become Contfu schema fields;
other presentation metadata such as titles, descriptions, previews, options,
and initial values is intentionally ignored. Diagnostics identify the document,
relative field path, code, and reason. By default the update helper writes them
to the CLI warning stream; `onDiagnostic` can collect or route them elsewhere.
They are not included in the HTTP request. `buildSanitySchemaSyncResult()`
returns the same payload plus diagnostics without sending a request.

A pushed Studio schema remains authoritative. Omitting an unsupported field on a
later push removes it from the normalized schema stored for that collection, so
review diagnostic output before deploying a changed schema definition.
