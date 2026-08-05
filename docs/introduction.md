# Introduction

## What Contfu is

Contfu gives applications one typed content contract across the CMS services your team
already uses. Connect a content source, choose the collections your application needs,
and use flows to shape that content for your application.

Your application reads its synchronized content locally, either through the Contfu runtime
(`@contfu/contfu`) or through a Server you run. This keeps your application content and files in infrastructure
you control.

## How it fits together

1. Connect a CMS service in Contfu.
2. Import the content collections you want to use.
3. Create application collections and flows to map source content into them.
4. Generate types and query the synchronized content from your application.

Contfu manages the configuration. The runtime that stores and serves synchronized content
runs with your application. See [Deployment](./deployment.md) for the available runtime
shapes.

## Choose a query setup

- **Embedded** — use [`@contfu/contfu`](./querying.md#embedded-runtime) in your app
  process to synchronize and query content directly from the Local Store.
- **Server + Client** — run [`@contfu/server`](./deployment.md#self-hosted-server) as an
  HTTP API and query it with [`@contfu/client`](./querying.md#http-client).

The query API is the same in both cases, so you can choose the setup that best fits your
application.

## Why use Contfu

- **One content model.** Normalize the differences between CMS services before they reach
  your application.
- **Typed application code.** Generate collection types and use them in your queries.
- **Your content stays with you.** The runtime stores synchronized content and files in
  your own environment.

## Next

- New to the model? Read [Concepts & glossary](./concepts.md).
- Ready to connect a source? Start with [Getting started](./getting-started.md).
