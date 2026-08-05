# Contfu Documentation

Contfu (_content funnel_) lets application and web developers consume content from
multiple CMS services through clear runtime boundaries. You connect your content
sources once in the managed Contfu, model how that content should flow into
your application's collections, and query the result through a single typed client —
regardless of whether the content originally came from Contentful, Sanity, Strapi, or
WordPress.

## Start here

- **[Introduction](./introduction.md)** — what Contfu is, the architecture, and the
  mental model behind it.
- **[Concepts & glossary](./concepts.md)** — the domain language used throughout these
  docs (Contfu, runtime, Collection, Flow, …).
- **[Getting started](./getting-started.md)** — a full end-to-end walkthrough: connect a
  source, model a collection, wire a flow, and query it from an app.

## Configure your content

How you set up content inside Contfu.

- **[Integrations](./integrations.md)** — connect a CMS service source (Notion, Strapi,
  Contentful, …) and register your application.
- **[Collections & schemas](./collections.md)** — model content buckets, property types,
  and reusable components.
- **[Flows](./flows.md)** — move items from a source collection into your application's
  collections, with mappings and filters.
- **[Localization & i18n](./i18n.md)** — active locales, locale mapping, and fallback.

## Query from your application

How an application reads content.

- **[Querying content](./querying.md)** — the typed query client (embedded and HTTP),
  filters, sorting, pagination, relations.
- **[System properties](./system-properties.md)** — the normalized `$`-prefixed
  metadata every item exposes.
- **[Rich content & media](./rich-content.md)** — render rich-text blocks with the
  framework adapters and serve files and media.

## Run it

How content reaches your application at runtime.

- **[Deployment](./deployment.md)** — the self-hosted Server (Docker / Node / Bun), the
  embedded Contfu runtime, sync acceptance/repair, and file/media storage options.
- **[CLI reference](./cli.md)** — manage every resource from the terminal.

---

> Contfu is a managed SaaS product at
> [contfu.com](https://contfu.com); there is no self-hosted Contfu. What you do
> host yourself is the **Server** (or embedded **Contfu runtime**) that holds a local copy
> of your synchronized content. See [Deployment](./deployment.md).
