# Introduction

## What Contfu is

Contfu is a **content funnel**. It sits between your content sources (CMS providers) and
your applications, and gives you one normalized, typed contract for content no matter
where it originally lives.

A typical content stack has a different SDK, field model, and query language per CMS. If
your content is spread across Contentful, a marketing team's Notion workspace, and a
legacy WordPress blog, your application has to speak three dialects. Contfu collapses
that into a single model: you describe how upstream content maps into your own
**collections**, and your application queries those collections through one client.

## The architecture

Contfu has a deliberate split between a managed cloud and a runtime you own.

```
┌─────────────────────────────────────────────────────────────────┐
│  Providers                                                        │
│  Contentful · Sanity · Strapi · WordPress · Notion · …            │
└───────────────┬─────────────────────────────────────────────────┘
                │  Push / Incremental Pull / Full Pull
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Service  (managed SaaS — contfu.com)                       │
│                                                                   │
│   Integrations → Collections → Flows (mappings, filters)          │
│   Schemas, components, localization, quotas                       │
└───────────────┬─────────────────────────────────────────────────┘
                │  Sync Messages   (over the Connector)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Local Runtime  (you host this)                                   │
│                                                                   │
│   Applies Sync Messages → Local Store (SQLite)                    │
│   Downloads Files, processes Media — inside your boundary         │
└───────────────┬─────────────────────────────────────────────────┘
                │
       ┌────────┴─────────┐
       ▼                  ▼
┌──────────────┐   ┌──────────────────────────────┐
│  Embedded    │   │  Server (@contfu/server)      │
│  query       │   │  HTTP query API over the      │
│  beside the  │   │  Local Store                  │
│  Local Store │   └───────────────┬──────────────┘
└──────────────┘                   │  HTTP
                                   ▼
                          ┌──────────────────┐
                          │  Client          │
                          │  (@contfu/client)│
                          └──────────────────┘
```

The two halves never blur:

- The **Cloud Service** is managed Contfu infrastructure. It holds your account,
  workspaces, integrations, collections, flows, and the synchronization orchestration. You
  do not host it — you use it at [contfu.com](https://contfu.com).
- The **Local Runtime** is yours. It receives **Sync Messages** from the Cloud Service
  through the **Connector**, applies them to a local **SQLite** database (the **Local
  Store**), and downloads and processes referenced **Files** and **Media** entirely inside
  your own infrastructure. The Cloud Service never stores or serves your files.

## Three ways an application reads content

Once the Local Runtime has a populated Local Store, your application reads from it in one
of three shapes:

1. **Embedded** — your app process runs the Local Runtime and queries the Local Store
   directly, in-process, with [`@contfu/contfu`](./querying.md#embedded-local-runtime). No
   network hop.
2. **Server + Client** — you run [`@contfu/server`](./deployment.md#self-hosted-server) as
   an HTTP API in front of the Local Store, and your app queries it over HTTP with
   [`@contfu/client`](./querying.md#http-client). Good for multiple consumers or a
   browser/edge client.
3. **Stream** — for live updates, consume the raw Sync Message stream directly with
   [`@contfu/connect`](./deployment.md#embedded-local-runtime).

In all cases the **query API is the same callable**, so you can move between embedded and
HTTP access without rewriting query code.

## Why the boundary matters

- **Files stay in your boundary.** The Local Runtime downloads and processes media; the
  Cloud Service is never in the file path. Your assets do not transit a third party.
- **Your store, your latency.** Queries hit a local SQLite database, not a remote API.
- **One contract.** Provider differences (field names, draft models, timestamp
  semantics, localization) are normalized in the Cloud Service before they ever reach
  your app. See [System properties](./system-properties.md) and
  [Localization](./i18n.md).

## Next

- New to the model? Read [Concepts & glossary](./concepts.md).
- Want to build something now? Jump to [Getting started](./getting-started.md).
