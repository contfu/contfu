# @contfu/svc-sources

Source adapters for the Contfu sync pipeline.

Each adapter implements the `Source` interface from `@contfu/svc-core` to pull content from a remote CMS and yield `Item` events.

## Supported sources

| Adapter     | Connection type |
| ----------- | --------------- |
| Contentful  | `contentful`    |
| Notion      | `notion`        |
| Strapi      | `strapi`        |
| Web (crawl) | `web`           |

## Usage

Adapters are consumed by `@contfu/svc-sync`. They are not intended for direct use outside the sync pipeline.

```ts
import { contentfulSource, notionSource, strapiSource, webSource } from "@contfu/svc-sources";
```
