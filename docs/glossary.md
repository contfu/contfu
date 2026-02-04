# Contfu Glossary

## Sources & Upstream Data

### Source
An upstream instance that exposes SourceCollections. Identifies the upstream system and holds required access credentials (e.g., OAuth tokens, API keys).

**Examples:** A Notion workspace, a Strapi instance, a website.

**Relationships:**
- One Source → many SourceCollections
- Multiple Sources of the same type allowed (e.g., two separate Notion workspaces)

**Configuration:**
- `includeRef` (boolean): When enabled, Items derived from this Source's SourceCollections will include a `ref` field linking back to the upstream SourceItem. Can be overridden per SourceCollection→Collection link.

### SourceCollection
A remote collection managed by a Source. Represents a specific data set within the upstream system.

**Examples:** A Notion database, a Strapi collection, a sitemap.xml.

**Relationships:**
- Many SourceCollections → one Source
- One SourceCollection → many SourceItems

### SourceItem
An individual item within a SourceCollection. Represents a single record/entry from the upstream system.

**Examples:** A Notion page, a Strapi entry, a URL from a sitemap.

### SourceItemEvent
An event notifying about a SourceItem change or deletion. Received from the Source when upstream data changes.

---

## Collections & Aggregated Data

### Collection
A collection managed by Contfu. Configured on the service to aggregate filtered items from multiple SourceCollections. Can be materialized on multiple Consumers/Clients.

**Relationships:**
- One Collection ← many SourceCollections (via links with filtering)
- One Collection → many Consumers

### Item
An item within a Collection. Created when a SourceItem passes through filtering into a Collection.

**Identity:**
- `id` (6 bytes): Deterministic hash derived from SourceCollection ID + SourceItem ID, salted with an application secret. Opaque to clients — cannot be reverse-engineered to identify the source.
- `collectionId` (integer): User-scoped collection identifier
- `ref` (binary, optional): Deep link to the upstream SourceItem. Enables clients to trace back to the original CMS entry. Stored as binary blob.

**Ref format examples:**
- Notion: `n:<uuid>`
- Strapi (self-hosted): full URL
- Other sources: source-specific format

**Ref configuration (opt-in):**
1. SourceCollection→Collection link setting (highest priority)
2. Source setting (default for all its SourceCollections)
3. Disabled by default (privacy-first)

**Design rationale:** By default, clients only see opaque IDs — no knowledge of Sources or SourceCollections. Users who need traceability (e.g., linking back to CMS) can explicitly enable ref population.

### ItemEvent
An event notifying about an Item change or deletion. Emitted to Consumers when Collection data changes.

---

## SourceCollection→Collection Links

Each link between a SourceCollection and a Collection can configure:
- **Filters**: Criteria determining which SourceItems flow into the Collection
- **includeRef** (boolean, optional): Override the Source-level `includeRef` setting for this specific link

---

## Consumers

### Consumer
A generic consumer that connects to Collections to receive ItemEvents. Base concept for different delivery mechanisms.

### Client (Service-side)
A concrete Consumer type. Allows external clients to subscribe to ItemEvents via WebSocket or SSE. Managed by the Contfu service.

### Application *(out of scope)*
A concrete Consumer type. An external application that receives ItemEvents via WebHooks. Not implemented in current scope.
