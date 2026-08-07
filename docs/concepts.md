# Concepts & Glossary

This page explains the terms you see when setting up Contfu and querying content from
your application.

## Your Contfu workspace

| Term             | Meaning                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Organization** | The account that owns your plan and workspaces.                                                                                   |
| **Workspace**    | The place where you configure content sources, collections, and flows for an application or team.                                 |
| **Integration**  | A connection to a CMS service, your application runtime, or a webhook endpoint.                                                   |
| **Scope**        | The part of a CMS that an integration exposes. For example, this maps to a dataset in Sanity or an environment in Contentful.     |
| **Collection**   | A named set of content items. Your application queries collections.                                                               |
| **Flow**         | A rule that brings content from an imported source collection into an application collection, with optional mappings and filters. |
| **Schema**       | The expected fields and types of the items in a collection.                                                                       |

## Application runtime

| Term                                       | Meaning                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contfu runtime and local store library** | `@contfu/contfu`, the package that keeps a local copy of your synchronized content up to date.                                                        |
| **Local Store**                            | The local content store maintained by the runtime. It uses SQLite by default.                                                                         |
| **Server**                                 | An optional HTTP API that you run over a Local Store.                                                                                                 |
| **Client**                                 | The `@contfu/client` package an application uses to query a Server over HTTP.                                                                         |
| **Connector**                              | The runtime component that maintains your application's connection to Contfu.                                                                         |
| **File**                                   | A content asset referenced by an item and materialized inside a target boundary when needed.                                                          |
| **File ID**                                | The canonical identity of one file revision. It changes when the bytes change, but not when a temporary download URL rotates.                         |
| **File Access Lease**                      | A Service URL that grants temporary access to a File's bytes. It is delivery state, not item content.                                                 |
| **Media Master**                           | The runtime's durable local source for deriving media transformations and variants without downloading the Service file again.                        |
| **Target ACK**                             | Confirmation that a target accepted a semantic item version. An Application ACK queues file work but does not mean the file or Media Master is ready. |

## Content model

| Term                | Meaning                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Item**            | A single entry in a collection.                                                                 |
| **Property**        | A typed field on an item, such as a title, date, image, or reference.                           |
| **Component**       | A reusable structured block that can appear in rich content, such as a callout or product card. |
| **System property** | A `$`-prefixed field supplied by Contfu, such as `$id`, `$changedAt`, or `$locale`.             |

## Localization

| Term               | Meaning                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **Locale**         | A language or regional variant, such as `en` or `en-US`.                                        |
| **Active locale**  | A locale selected for a localized collection.                                                   |
| **Locale mapping** | A rule that maps a source CMS locale value to one of your active locales.                       |
| **Fallback**       | An optional query behavior that returns a related locale when the requested one is unavailable. |

See [Localization & i18n](./i18n.md) for setup details, and [Deployment](./deployment.md)
for the runtime options.
