# Product Requirements Document: Contfu (Proxy CMS)

## Overview

**Product Name:** Contfu (Content Funnel)
**Version:** 1.0
**Last Updated:** January 2026

Contfu is a **proxy CMS** synchronization service that aggregates content from multiple upstream Content Management Systems into a unified, locally-hosted database. It enables developers to consume content from various CMS platforms through a single, consistent API.

---

## Problem Statement

Modern applications often need to consume content from multiple CMS platforms simultaneously. Each CMS has its own API, data model, authentication, and rate limits. This creates several challenges:

1. **Integration complexity** - Developers must learn and maintain integrations with multiple CMS APIs
2. **Inconsistent data models** - Each CMS structures content differently
3. **Network latency** - Fetching content from remote APIs adds latency to user requests
4. **Rate limiting** - CMS APIs have rate limits that can impact application performance
5. **Offline availability** - Applications cannot function when upstream CMS services are unavailable

---

## Solution

Contfu acts as a **proxy layer** between upstream CMS platforms and client applications:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Notion    │     │   Strapi    │     │  (Future)   │
│  (Source)   │     │  (Source)   │     │   Sources   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
                 ┌─────────────────────────┐
                 │    Contfu Sync Service  │
                 │  ┌───────────────────┐  │
                 │  │   Metadata DB     │  │
                 │  │ (sources, cursors)│  │
                 │  └───────────────────┘  │
                 └───────────┬─────────────┘
                             │ WebSocket
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌───────────┐      ┌───────────┐      ┌───────────┐
    │ Client 1  │      │ Client 2  │      │ Client N  │
    │┌─────────┐│      │┌─────────┐│      │┌─────────┐│
    ││Local DB ││      ││Local DB ││      ││Local DB ││
    ││(content)││      ││(content)││      ││(content)││
    │└─────────┘│      │└─────────┘│      │└─────────┘│
    └───────────┘      └───────────┘      └───────────┘
```

### Architecture Principles

**Service is stateless for content.** The sync service does not persist content or media. It fetches from upstream sources, transforms data, and streams to clients via WebSocket. The service database only stores metadata: source configurations, sync cursors, collection definitions, and client authentication.

**Clients own their data.** Each client maintains its own local SQLite database containing synchronized content and downloaded media. The client library provides a query API for accessing this local data. This enables offline access and low-latency queries.

---

## Target Users

### Primary Users

- **Application Developers** building content-driven applications (websites, mobile apps, documentation sites)
- **Development Teams** managing content across multiple CMS platforms
- **Agencies** building client applications that consume content from various sources

### User Personas

**Alex - Full-Stack Developer**

- Builds marketing websites and documentation portals
- Uses Notion for internal docs, Strapi for marketing content
- Needs unified content access without managing multiple integrations

**Sarah - Technical Lead**

- Manages a team building a multi-brand content platform
- Different brands use different CMS platforms
- Needs consistent data model across all content sources

---

## Core Concepts

### Data Sources

A **Data Source** represents a connection to an upstream CMS. Each source has:

- **Type** - The CMS platform (Notion, Strapi, etc.)
- **Credentials** - API keys, tokens, or other authentication
- **Configuration** - Platform-specific settings (workspace ID, base URL, etc.)

### Collections

A **Collection** is a logical grouping of content items synchronized from one or more data sources. Collections:

- Map upstream content types to a unified schema
- Can aggregate content from multiple sources
- Define which properties and content blocks to synchronize

### Items

An **Item** is a single piece of content within a collection. Items have:

- **ID** - Unique identifier (derived from source)
- **Reference** - Original identifier in the upstream CMS
- **Properties** - Structured metadata (title, date, author, etc.)
- **Content** - Rich content blocks (paragraphs, headings, images, etc.)
- **Timestamps** - Created, changed, and published dates

### Clients

**Clients** are applications that consume synchronized content. Each client:

- Connects to the sync service via WebSocket to receive real-time updates
- Maintains its own **local SQLite database** for storing content and media
- Downloads and stores media files locally (with optional optimization)
- Provides a **query API** for accessing the local content database

The client library handles synchronization, local storage, and provides a clean API for querying content. Applications never query the sync service directly for content—all reads come from the local database.

### Data Flow

```
1. SYNC: Service fetches from upstream sources
   ┌─────────────────────────────────────────────────────────────────┐
   │  Notion API ──────┐                                             │
   │  Strapi API ──────┼──▶ Sync Service ──▶ Transform ──▶ Stream    │
   │  Other APIs ──────┘         │                           │       │
   │                             ▼                           │       │
   │                      Metadata DB                        │       │
   │                   (cursors, config)                     │       │
   └─────────────────────────────────────────────────────────│───────┘
                                                             │
2. STREAM: Service sends events to connected clients         │
   ┌─────────────────────────────────────────────────────────│───────┐
   │                        WebSocket                        ▼       │
   │  ┌─────────────┬─────────────┬─────────────────────────────┐   │
   │  ▼             ▼             ▼                             │   │
   │ Client 1    Client 2    Client N                           │   │
   └────────────────────────────────────────────────────────────┘   │
                                                                     │
3. STORE: Clients persist content and media locally                  │
   ┌─────────────────────────────────────────────────────────────────┘
   │  Client receives event ──▶ Stores in local DB ──▶ Downloads media
   │                                   │                      │
   │                                   ▼                      ▼
   │                            Local SQLite           Local Files
   │                         (content, metadata)     (images, assets)
   └─────────────────────────────────────────────────────────────────

4. QUERY: Application reads from client's local database
   ┌─────────────────────────────────────────────────────────────────┐
   │  Application ──▶ Client Query API ──▶ Local SQLite ──▶ Response │
   │                                              │                  │
   │                        (No network calls - all local)           │
   └─────────────────────────────────────────────────────────────────┘
```

---

## Functional Requirements

### FR1: Data Source Management

| ID    | Requirement                                   | Priority |
| ----- | --------------------------------------------- | -------- |
| FR1.1 | Support Notion as a data source               | P0       |
| FR1.2 | Support Strapi as a data source               | P1       |
| FR1.3 | Allow multiple data sources per tenant        | P0       |
| FR1.4 | Secure credential storage for each source     | P0       |
| FR1.5 | Source health monitoring and status reporting | P1       |
| FR1.6 | Configurable sync intervals per source        | P2       |

### FR2: Content Synchronization

| ID    | Requirement                                     | Priority |
| ----- | ----------------------------------------------- | -------- |
| FR2.1 | Incremental sync (only changed content)         | P0       |
| FR2.2 | Full sync on demand                             | P1       |
| FR2.3 | Automatic conflict resolution (last-write-wins) | P0       |
| FR2.4 | Content transformation during sync              | P1       |
| FR2.5 | Media/asset synchronization and optimization    | P1       |
| FR2.6 | Sync status and progress reporting              | P1       |

### FR3: Collection Management

| ID    | Requirement                                       | Priority |
| ----- | ------------------------------------------------- | -------- |
| FR3.1 | Create collections with custom schemas            | P0       |
| FR3.2 | Map source content types to collections           | P0       |
| FR3.3 | Define property mappings and transformations      | P1       |
| FR3.4 | Support content relationships/links between items | P0       |
| FR3.5 | Collection versioning and schema migrations       | P2       |

### FR4: Client Connectivity

| ID    | Requirement                                    | Priority |
| ----- | ---------------------------------------------- | -------- |
| FR4.1 | WebSocket connection for real-time updates     | P0       |
| FR4.2 | Support multiple concurrent clients per tenant | P0       |
| FR4.3 | Client authentication via API keys             | P0       |
| FR4.4 | Efficient binary message protocol (msgpack)    | P0       |
| FR4.5 | Acknowledgment-based message delivery          | P1       |
| FR4.6 | Client-specific collection subscriptions       | P2       |

### FR5: Client Local Database

Each client application has its own local SQLite database for storing synchronized content and media.

| ID    | Requirement                                     | Priority |
| ----- | ----------------------------------------------- | -------- |
| FR5.1 | Client-side SQLite database for content storage | P0       |
| FR5.2 | Automatic schema migrations on client           | P0       |
| FR5.3 | Query API for accessing local content           | P0       |
| FR5.4 | Local media file storage with path references   | P0       |
| FR5.5 | Full-text search support                        | P2       |
| FR5.6 | Database backup and restore                     | P2       |

### FR6: Service Metadata Database

The sync service maintains a metadata database for configuration and sync state (no content storage).

| ID    | Requirement                                      | Priority |
| ----- | ------------------------------------------------ | -------- |
| FR6.1 | Store data source configurations and credentials | P0       |
| FR6.2 | Track sync cursors for incremental updates       | P0       |
| FR6.3 | Store collection definitions and mappings        | P0       |
| FR6.4 | Manage client authentication keys                | P0       |
| FR6.5 | No content or media stored on service            | P0       |

---

## Non-Functional Requirements

### NFR1: Performance

| ID     | Requirement                           | Target      |
| ------ | ------------------------------------- | ----------- |
| NFR1.1 | Sync latency for incremental updates  | < 5 seconds |
| NFR1.2 | Client message delivery latency       | < 100ms     |
| NFR1.3 | Database query response time          | < 50ms      |
| NFR1.4 | Support concurrent clients per tenant | 100+        |
| NFR1.5 | Memory usage (idle)                   | < 100MB     |

### NFR2: Reliability

| ID     | Requirement                                | Target   |
| ------ | ------------------------------------------ | -------- |
| NFR2.1 | Service uptime                             | 99.9%    |
| NFR2.2 | Data consistency after sync                | 100%     |
| NFR2.3 | Graceful handling of source unavailability | Required |
| NFR2.4 | Automatic recovery from crashes            | Required |

### NFR3: Security

| ID     | Requirement                            | Target   |
| ------ | -------------------------------------- | -------- |
| NFR3.1 | Encrypted credential storage           | AES-256  |
| NFR3.2 | Secure WebSocket connections           | WSS/TLS  |
| NFR3.3 | API key authentication                 | Required |
| NFR3.4 | Audit logging for sensitive operations | Required |

### NFR4: Scalability

| ID     | Requirement             | Target   |
| ------ | ----------------------- | -------- |
| NFR4.1 | Items per collection    | 100,000+ |
| NFR4.2 | Collections per tenant  | 50+      |
| NFR4.3 | Data sources per tenant | 10+      |

### NFR5: Data Storage Separation

| ID     | Requirement                                                 | Target   |
| ------ | ----------------------------------------------------------- | -------- |
| NFR5.1 | Service stores only metadata (sources, cursors, config)     | Required |
| NFR5.2 | Service does not persist content items or media files       | Required |
| NFR5.3 | Each client maintains its own local SQLite database         | Required |
| NFR5.4 | Clients store content and media locally                     | Required |
| NFR5.5 | Service remains stateless for content (can restart cleanly) | Required |

---

## Supported CMS Platforms

### Phase 1: Notion (Current)

**Supported Features:**

- Database synchronization
- Page content blocks (paragraphs, headings, lists, code, quotes, images, tables)
- Property types (text, number, select, multi-select, date, checkbox, URL, email, phone, relation)
- Nested blocks and child pages
- Media files (images, files)

**Limitations:**

- Real-time webhooks not available (polling-based sync)
- Rate limited to 3 requests/second

### Phase 2: Strapi (Planned)

**Planned Features:**

- Content type synchronization
- Component and dynamic zone support
- Media library integration
- Relation fields
- Webhook-based real-time sync

### Future Platforms (Roadmap)

- Contentful
- Sanity
- WordPress (Headless)
- Directus
- Ghost

---

## Content Block Types

The system supports a unified content block model:

| Block Type    | Code | Description                           |
| ------------- | ---- | ------------------------------------- |
| Paragraph     | `p`  | Text paragraph with inline formatting |
| Heading 1     | `h1` | Top-level heading                     |
| Heading 2     | `h2` | Second-level heading                  |
| Heading 3     | `h3` | Third-level heading                   |
| Bulleted List | `ul` | Unordered list item                   |
| Numbered List | `ol` | Ordered list item                     |
| To-do         | `td` | Checkbox item                         |
| Quote         | `q`  | Block quote                           |
| Code          | `c`  | Code block with language              |
| Image         | `i`  | Image with URL and caption            |
| Table         | `t`  | Table with rows and cells             |
| Divider       | `d`  | Horizontal divider                    |
| Callout       | `co` | Callout/admonition block              |
| Toggle        | `tg` | Collapsible content                   |
| Custom        | `x`  | Custom/embedded block                 |

---

## API & Protocol

### WebSocket Protocol

**Connection:**

```
wss://<host>/ws
```

**Message Format:** Binary (msgpack)

**Commands (Client → Server):**

| Command | Code | Payload                                      |
| ------- | ---- | -------------------------------------------- |
| CONNECT | 0    | `{ apiKey: string, collections?: string[] }` |
| ACK     | 1    | `{ cursor: Buffer }`                         |

**Events (Server → Client):**

| Event     | Code | Payload                                                          |
| --------- | ---- | ---------------------------------------------------------------- |
| CONNECTED | 0    | `{ consumerId: Buffer }`                                         |
| CHANGED   | 1    | `[collection, id, createdAt, changedAt, [ref, props, content?]]` |
| DELETED   | 2    | `[collection, id]`                                               |
| LIST_IDS  | 3    | `[collection, ids[]]`                                            |
| CHECKSUM  | 4    | `[collection, checksum]`                                         |
| ERROR     | 5    | `{ code: number, message: string }`                              |

### Client Query API

The client library provides a query API for accessing the local SQLite database. All queries run against the client's local data—fast, offline-capable, and no network latency.

```typescript
import { createContfuClient } from "@contfu/client";

const client = await createContfuClient({
  syncUrl: "wss://sync.example.com/ws",
  apiKey: "...",
  dbPath: "./content.db", // Local SQLite database
  mediaDir: "./media", // Local media storage
});

// Connect and sync (populates local database)
await client.connect();

// All queries run against the local database
const pages = await client.getPages();
const page = await client.getPage({ id: "abc123" });
const page = await client.getPage({ path: "/blog/hello-world" });
const links = await client.getPageLinks({ from: pageId });

// Access local media files
const imagePath = client.getMediaPath(asset.id); // Returns local file path
```

---

## Deployment Model

### Self-Hosted (Primary)

Contfu runs locally on the tenant's infrastructure:

```
                    Upstream CMS Platforms
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐         ┌─────────┐         ┌─────────┐
   │ Notion  │         │ Strapi  │         │  ...    │
   └────┬────┘         └────┬────┘         └────┬────┘
        └───────────────────┼───────────────────┘
                            │ API calls
┌───────────────────────────┼────────────────────────────┐
│  Tenant Infrastructure    ▼                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Contfu Sync Service                │   │
│  │  ┌─────────────┐  ┌──────────────┐              │   │
│  │  │ Sync Worker │  │  WebSocket   │              │   │
│  │  │(fetches from│  │   Server     │              │   │
│  │  │  sources)   │  │(streams to   │              │   │
│  │  └──────┬──────┘  │  clients)    │              │   │
│  │         │         └──────┬───────┘              │   │
│  │         ▼                │                      │   │
│  │  ┌────────────────┐      │                      │   │
│  │  │  Metadata DB   │◄─────┘                      │   │
│  │  │ (sources, sync │      │                      │   │
│  │  │  cursors only) │      │                      │   │
│  │  └────────────────┘      │ WebSocket            │   │
│  └──────────────────────────┼──────────────────────┘   │
│                             │                          │
│  ┌──────────────────────────┼──────────────────────┐   │
│  │      Client Applications │                      │   │
│  │     ┌────────────────────┼────────────────┐     │   │
│  │     ▼                    ▼                ▼     │   │
│  │ ┌────────────┐    ┌────────────┐   ┌──────────┐ │   │
│  │ │   App 1    │    │   App 2    │   │  App N   │ │   │
│  │ │┌──────────┐│    │┌──────────┐│   │┌────────┐│ │   │
│  │ ││ Local DB ││    ││ Local DB ││   ││Local DB││ │   │
│  │ ││ (content,││    ││ (content,││   ││(content││ │   │
│  │ ││  media)  ││    ││  media)  ││   ││ media) ││ │   │
│  │ │└──────────┘│    │└──────────┘│   │└────────┘│ │   │
│  │ └────────────┘    └────────────┘   └──────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

**Benefits:**

- Content and media stay within tenant's infrastructure (on client machines)
- Low latency queries against local client database
- Offline access - clients work without connection to sync service
- Service remains lightweight and stateless for content
- Full control over updates and configuration

### Managed Cloud (Future)

For tenants who prefer a managed solution:

- Hosted sync service
- Media CDN and optimization
- Automated backups
- Multi-region deployment

---

## Pricing Model

### Tiers

| Tier       | Sources   | Collections | Items     | Clients   | Price  |
| ---------- | --------- | ----------- | --------- | --------- | ------ |
| Starter    | 1         | 5           | 1,000     | 5         | Free   |
| Pro        | 3         | 20          | 10,000    | 25        | $29/mo |
| Team       | 10        | 50          | 100,000   | 100       | $99/mo |
| Enterprise | Unlimited | Unlimited   | Unlimited | Unlimited | Custom |

### Add-ons

- Additional sources: $10/mo each
- Media optimization: $19/mo
- Priority support: $49/mo

---

## Success Metrics

| Metric                 | Target         | Measurement           |
| ---------------------- | -------------- | --------------------- |
| Time to first sync     | < 5 minutes    | Onboarding analytics  |
| Sync reliability       | > 99.9%        | Error rate monitoring |
| Client satisfaction    | > 4.5/5        | NPS surveys           |
| Monthly active tenants | Growth 20% MoM | Usage analytics       |
| Churn rate             | < 5% monthly   | Subscription data     |

---

## Roadmap

### Phase 1: Foundation (Current)

- [x] Notion source integration
- [x] Local SQLite database
- [x] WebSocket client connectivity
- [x] Basic sync functionality
- [x] Worker-based architecture

### Phase 2: Strapi Integration (Q2 2026)

- [ ] Strapi source adapter
- [ ] Webhook-based real-time sync
- [ ] Component/dynamic zone support
- [ ] Admin dashboard (web UI)

### Phase 3: Enhanced Features (Q3 2026)

- [ ] Full-text search
- [ ] Media CDN integration
- [ ] Collection versioning
- [ ] Query builder API

### Phase 4: Scale & Enterprise (Q4 2026)

- [ ] Managed cloud offering
- [ ] Multi-region support
- [ ] SSO/SAML authentication
- [ ] Advanced analytics

---

## Appendix

### A. Glossary

| Term             | Definition                                                            |
| ---------------- | --------------------------------------------------------------------- |
| Upstream CMS     | The source content management system (Notion, Strapi, etc.)           |
| Proxy CMS        | Contfu's role as an intermediary layer                                |
| Sync Service     | The Contfu server that fetches from sources and streams to clients    |
| Service Database | Metadata storage on the service (sources, cursors, config—no content) |
| Client           | An application consuming content via WebSocket and local database     |
| Client Database  | Local SQLite database on each client storing content and media        |
| Tenant           | A paying customer with their own Contfu instance                      |
| Source           | A configured connection to an upstream CMS                            |
| Collection       | A logical grouping of synchronized content                            |
| Item             | A single piece of content (page, entry, etc.)                         |
| Block            | A unit of rich content (paragraph, image, etc.)                       |

### B. Related Documents

- [CLAUDE.md](./CLAUDE.md) - Development guidelines
- [Architecture Decision Records](./docs/adr/) - Technical decisions
- [API Reference](./docs/api/) - Detailed API documentation

### C. Revision History

| Version | Date    | Author | Changes     |
| ------- | ------- | ------ | ----------- |
| 1.0     | 2026-01 | -      | Initial PRD |
