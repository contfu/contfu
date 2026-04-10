# Maintaining Or Extending An Existing Setup

Use this reference when Contfu is already present and the task is to inspect or change only part of the setup.

## Start from live state

Check the current resources first:

```bash
contfu status -f json
contfu connections list -f json
contfu collections list -f json
contfu flows list -f json
```

Build a small working map for yourself:

- which connection is the CMS source
- which connection is the app consumer
- which collections belong to that app connection
- which flows already exist
- which source collections are still undiscovered or unwired

## Common maintenance workflows

### Add another source collection to an existing app

1. Discover source collections on the existing CMS connection:

```bash
contfu connections scan <source-connection-id>
```

2. Create the new target collection on the existing app connection if needed:

```bash
contfu collections create --display-name "Events" --connection-id <app-connection-id>
```

3. Create the flow:

```bash
contfu flows create --source-id <source-collection-id> --target-id <target-collection-id>
```

4. Regenerate connection-wide types for the existing app connection:

```bash
contfu connections types <app-connection-id> > src/types/contfu.ts
```

5. Update the app's shared `cq` module consumers where the new collection should be queried.

### Inspect why an app cannot see a collection

Check whether the target collection belongs to the app connection:

```bash
contfu collections list -f json
```

If `connectionId` is `null`, the app will not see it. Create a client-associated collection and rewire the flow.

### Update or remove a flow

Inspect the existing flows:

```bash
contfu flows list -f json
contfu flows get <flow-id>
```

Delete and recreate when the source-target pairing should change:

```bash
contfu flows delete <flow-id>
contfu flows create --source-id <source-id> --target-id <target-id>
```

## App follow-through

Do not stop at resource changes when the app is expected to use the new content.

- regenerate types
- keep the central `cq` module current
- import the shared query builder where new content is fetched
- replace any placeholder content path that the new collection makes obsolete

## Context discipline

This reference is for targeted work. If the task grows into a full setup, move to `ref-project-setup.md`. If the task becomes mainly app-query wiring, move to `ref-client-sdk.md`.
