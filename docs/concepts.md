# Concepts & Glossary

Contfu uses precise terms throughout the product and these docs. This page is the
reference for that language, grouped by where each concept lives. The authoritative
domain definitions are maintained in the repository's `CONTEXT.md`; this page is the
user-facing summary.

## Where things live

| Term              | Meaning                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloud Service** | The managed Contfu SaaS at contfu.com. Holds accounts, workspaces, integrations, collections, flows, and synchronization orchestration. You do not host it. |
| **Local Runtime** | The component you host that applies Sync Messages to a Local Store and processes Media Files. Shipped as `@contfu/contfu`.                                  |
| **Local Store**   | The SQLite database (and file storage) the Local Runtime maintains. Your application's source of content.                                                   |
| **Server**        | A user-hosted HTTP API (`@contfu/server`) that exposes query endpoints over a Local Store.                                                                  |
| **Client**        | The library an application uses to query a Server over HTTP (`@contfu/client`). A Client only queries; it never synchronizes.                               |
| **Connector**     | The component that establishes the synchronization link to the Cloud Service and receives Sync Messages (`@contfu/connect`).                                |
| **Application**   | Your external software system that receives synchronized content.                                                                                           |

## Account & commercial

| Term              | Meaning                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Organization**  | A customer account that owns commercial plan and quota context.                                                                    |
| **Plan**          | The commercial package defining an Organization's quotas and enforcement.                                                          |
| **Workspace**     | An operational area inside an Organization that contains synchronization resources (integrations, collections, components, flows). |
| **Quota Blocked** | A state where resource creation or synchronization stops because an Organization exceeded an enforced quota.                       |

## Sources & integrations

| Term                        | Meaning                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider**                | An external content system type behind an Integration (Contentful, Sanity, Strapi, WordPress, Notion, …).                                                             |
| **Integration**             | An authenticated link between a workspace and a Provider or Application. May have an **Ingress** role (provides items), an **Egress** role (receives items), or both. |
| **Application Integration** | The current Egress integration type — represents your Application in the Cloud Service. The Cloud-side counterpart of a Connector.                                    |
| **Scope**                   | A provider-side namespace that scopes the collections an Ingress integration exposes. Sanity datasets and Contentful environments are both modeled as Scopes.         |
| **Push**                    | Change discovery where a Provider notifies Contfu about changed items.                                                                                                |
| **Incremental Pull**        | Change discovery where Contfu asks a Provider for changes since a cursor/timestamp.                                                                                   |
| **Full Pull**               | Change discovery where Contfu asks a Provider for the complete current contents of a collection.                                                                      |

## Content model

| Term                     | Meaning                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Collection**           | A named set of content items, in the Cloud Service or in a Local Store.                                                                                                  |
| **Item**                 | A single content entry within a collection.                                                                                                                              |
| **Property**             | A named structured value in an item's props object, described by the collection's Schema.                                                                                |
| **Schema**               | The expected shape of items in a collection. A **Fixed Schema** is defined explicitly; a **Derived Schema** is inferred from inflows and mappings.                       |
| **Native Property Type** | A Contfu-owned property kind with a normalized value and a generated application type across providers. Defines sync/query contracts — not editor widgets or validation. |
| **Component**            | A reusable structured content block with named props and nested children. A first-class workspace resource scoped to an ingress integration.                             |
| **File**                 | A binary object referenced by an item. A **Media File** is a File with media-specific handling.                                                                          |

### Collection roles

| Term                     | Meaning                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **Connected Collection** | A collection directly attached to an integration.                                    |
| **Virtual Collection**   | A collection not directly attached to any integration.                               |
| **Linked Collection**    | A collection participating in at least one flow.                                     |
| **Localized Collection** | A collection whose items may have per-locale variants.                               |
| **Stale Collection**     | A collection whose incremental state cannot be trusted until a Full Pull repairs it. |

## Flows & delivery

| Term             | Meaning                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flow**         | A configured path that moves items from one collection into another. An **Inflow** enters a collection; an **Outflow** leaves one.                             |
| **Mapping**      | A rule that translates item properties from a source collection to a target collection in a flow.                                                              |
| **Filter**       | A rule that decides whether an item passes through a flow.                                                                                                     |
| **Frozen Flow**  | A flow that no longer moves items because its schema, mapping, or filter contract became invalid.                                                              |
| **Sync Message** | A message delivered from Contfu to an Egress integration to keep its synchronized view current (an item change, deletion, schema change, or lifecycle change). |
| **Snapshot**     | A bounded sequence of Sync Messages that initializes or repairs an Egress integration's view.                                                                  |

## Localization

| Term                      | Meaning                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Locale**                | A language or regional variant used to select localized content.                                        |
| **Active Locale**         | A locale selected for a localized collection's synchronization and generated types.                     |
| **Locale Mapping**        | A user-defined rule mapping a source locale value to an Active Locale.                                  |
| **Localization Layer**    | User-controlled localization settings layered on top of provider-detected defaults.                     |
| **Fallback Grouping Key** | A collection property that groups localized variants of the same logical item, used for query fallback. |

See [Localization & i18n](./i18n.md) for the full model.

## State & incidents

| Term                   | Meaning                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Paused**             | An intentionally stopped synchronization state set by a user or operator.                                                   |
| **Incident**           | A user-visible synchronization problem that needs attention.                                                                |
| **Mapping Failure**    | An incident where an item cannot be transformed by a flow's mappings.                                                       |
| **Validation Failure** | An incident where a parsed or mapped item does not satisfy the target schema.                                               |
| **Held Item**          | An item withheld from downstream delivery because an incident prevents safe synchronization.                                |
| **Draft Item**         | An upstream item version not yet published in the provider. When draft sync is enabled, synchronized items expose `$draft`. |

## How they relate

A few load-bearing relationships worth internalizing:

- An **Organization** has one or more **Workspaces**; a workspace contains
  **Integrations**, **Collections**, **Components**, and **Flows**.
- An **Ingress Integration** exposes one or more source **Collections**; a **Flow** moves
  their items into your own target **Collections**.
- A collection has exactly one **Schema** — fixed, or derived from the union of its
  inflows' derived schemas.
- An incompatible upstream schema change **freezes** the affected flow rather than
  silently breaking your application contract; an unprocessable single item is **held**
  instead.
- **Files** are downloaded and processed by the **Local Runtime** inside your boundary —
  never by the Cloud Service.
- A **Client** queries a **Server**; it never synchronizes with a Server or the Cloud
  Service. Synchronization is the **Connector**'s job.
