# @contfu/cli

Command-line tool for managing Contfu service resources.

## Installation

```sh
npm install -g @contfu/cli
```

## Usage

```sh
contfu [--help] <command> [args...]
```

### Commands

```
login [--no-browser]              Authenticate with the Contfu service
logout                            Clear stored credentials
status                            Show resource summary

connections list|get|create|update|delete
collections  list|get|create|update|delete
flows        list|get|create|update|delete

connections scan <id>             Scan source collections for a connection
connections add <id>              Add scanned source collections to Contfu
connections types                 List valid connection types
collections types                 Generate TypeScript types for a collection
items query  --collection <id>    Query items
items count  --collection <id>    Count items
```

## Authentication

Credentials are stored locally after `contfu login`. The `CONTFU_API_KEY` environment variable can be used as an alternative to interactive login.

`CONTFU_URL` is only required for `items` commands — it specifies the base URL of the Contfu server that holds the data.

## Scanning and adding source collections

Use `contfu connections scan <connection-id>` to inspect source collections available from a source connection. The default output is a table; pass `--format json` for automation.

Use `contfu connections add <connection-id> --refs <comma-separated-refs>` to add selected scanned collections to Contfu, or `--all` to add every scanned collection that is not already added.

In interactive terminals, `contfu connections scan <connection-id> --select` lets you pick multiple scanned collections and immediately add them.
