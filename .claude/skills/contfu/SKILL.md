---
name: contfu
description: Manage Contfu service resources (sources, collections, consumers, connections, influxes), query content items, and generate TypeScript types using the Contfu CLI.
---

# Contfu Service Skill

## Prerequisites

- CLI available via `bunx @contfu/cli` (or `contfu` if installed globally from the monorepo)
- User must be authenticated: `contfu login`
- Alternatively, set `CONTFU_API_KEY` environment variable

## Resource CRUD

Five resource types: **sources**, **collections**, **consumers**, **connections**, **influxes**.

All resources support: `list`, `get <id>`, `create`, `update <id>`, `delete <id>`.

```bash
# List (table format by default, use -f json for JSON)
contfu sources list
contfu collections list -f json

# Get by ID
contfu sources get 1

# Delete
contfu connections delete 5
```

### Create / Update flags per resource

**sources** (required for create: `--name`, `--type`):

```bash
contfu sources create --name "My CMS" --type contentful --url https://example.com
contfu sources update 1 --name "Renamed"
```

Run `contfu sources types` to see valid source types.

**collections** (required for create: `--display-name`):

```bash
contfu collections create --display-name "Blog Posts" --name blog-posts
contfu collections update 1 --display-name "Articles"
```

**consumers** (required for create: `--name`):

```bash
contfu consumers create --name "website"
contfu consumers update 1 --name "mobile-app"
```

**connections** (required for create: `--consumer-id`, `--collection-id`):

```bash
contfu connections create --consumer-id 1 --collection-id 2
```

**influxes** (required for create: `--collection-id`, `--source-collection-id`):

```bash
contfu influxes create --collection-id 1 --source-collection-id 3
```

All resources accept `--[no-]include-ref` and `-d <json>` (raw JSON body) as alternatives to flags.

## Type Generation

```bash
# TypeScript types for a collection's schema
contfu collections types <id|name>

# TypeScript types for all collections connected to a consumer
contfu consumers types <id>
```

## Item Queries

Query items through a running client HTTP server:

```bash
# Query with filters, sorting, pagination
contfu items query -u http://localhost:3000 \
  --collection blog-posts \
  --filter "status=published" \
  --sort "createdAt:desc" \
  --limit 10 --offset 0 \
  --fields "title,slug,body" \
  --include "author" \
  --flat

# Count items
contfu items count -u http://localhost:3000 --collection blog-posts
```

The `-u/--client-url` flag is required and points to the client app's HTTP server.

## Common Workflows

### Set up a source-to-consumer pipeline

```bash
# 1. Create a source
contfu sources create --name "Contentful" --type contentful --url https://cdn.contentful.com

# 2. Create a collection
contfu collections create --display-name "Blog Posts" --name blog-posts

# 3. Link source to collection via influx (use source-collection-id from the source)
contfu influxes create --collection-id 1 --source-collection-id 42

# 4. Create a consumer
contfu consumers create --name "website"

# 5. Connect consumer to collection
contfu connections create --consumer-id 1 --collection-id 1
```

### Inspect existing setup

```bash
contfu sources list
contfu influxes list
contfu collections list
contfu connections list
contfu consumers list
```
