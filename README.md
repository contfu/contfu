# contfu

## What is it?

Contfu is an acronym for _content funnel_.
It allows application and web developers to consume data easily from multiple CMS systems.

# Concepts

A user can decide where the source of truth is stored:

## On their own infrastructure

In this case, there can be only one client per user, which is connected to all collections.

The features included:

- Streaming of items from the upstream CMSs
- Collections
- Schema versioning

## On the contfu server

In this case, the user has more features available:

- Multi-client: The user can decide which collections are streamed to which clients
- Media optimization and storage
- Automatic backups
- Cloud Automation
- Client-specific automation
