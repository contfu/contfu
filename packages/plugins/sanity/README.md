# @contfu/sanity

Post your Sanity Studio schema to Contfu so Contfu can use the Studio schema as the authoritative collection schema instead of sampling Content Lake documents.

## Install

```bash
bun add @contfu/sanity
```

`@contfu/sanity` has a peer dependency on `sanity` and consumes your Studio `schemaTypes` array.

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
  schemaTypes,
});

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
});
```
