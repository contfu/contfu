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
consumers    list|get|create|update|delete

connections types                 List valid connection types
collections types                 Generate TypeScript types for a collection
items query  --collection <id>    Query items
items count  --collection <id>    Count items
```

## Authentication

Credentials are stored locally after `contfu login`. The `CONTFU_TOKEN` environment variable can be used as an alternative to interactive login.

`CONTFU_URL` is only required for `items` commands — it specifies the base URL of the Contfu server that holds the data.
