---
name: forgejo
description: Interact with the Forgejo instance at code.sven-rogge.com. Use when checking CI run status, fetching job logs, managing labels, or creating PRs through the tea CLI and local helper scripts.
---

# Forgejo

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Configuration

Credentials come from `.env`:

```text
FORGEJO_USERNAME=<username>
FORGEJO_PASSWORD=<password>
FORGEJO_URL=https://code.sven-rogge.com
FORGEJO_REPO=contfu/contfu
```

The session cookie is cached in `.forgejo-session` and refreshed as needed. The `tea` CLI uses the stored `forgejo` login.

## Login

Run this when the web session is missing or expired:

```bash
scripts/forgejo-login
```

## Scripts

Run scripts from the repo root.

### `forgejo-token`

Print the Forgejo PAT from the local tea CLI config.

```bash
TOKEN=$(./.agents/skills/forgejo/scripts/forgejo-token)
```

### `forgejo-label {add|remove|set-status} <issue> <label>`

Manage issue labels. `set-status` removes other status labels first.

```bash
scripts/forgejo-label add 3 enhancement
scripts/forgejo-label remove 3 bug
scripts/forgejo-label set-status 3 in-progress
```

### `ci-status [run_id]`

Show job status for the latest run or a specific run.

```bash
scripts/ci-status
scripts/ci-status 5
```

### `ci-wait [run_id] [--timeout <seconds>]`

Wait until a run reaches a settled state.

```bash
scripts/ci-wait
scripts/ci-wait 5
scripts/ci-wait --timeout 300
```

### `ci-logs <run_id> [job_index] [-v]`

Fetch job logs. Use `-v` for the full log.

```bash
scripts/ci-logs 5 1
scripts/ci-logs 5 1 -v
```

### PR comment helpers

```bash
scripts/pr-comments <pr_number>
scripts/pr-reply <pr_number> "<reply body>"
scripts/pr-resolve <comment_id>
```

## tea CLI

List runs:

```bash
tea actions runs --login forgejo --repo contfu/contfu
```

List tasks for a run:

```bash
tea api --login forgejo "/api/v1/repos/contfu/contfu/actions/tasks?run_id=<id>"
```

Create a PR:

```bash
tea pr create --login forgejo --repo contfu/contfu \
  --base main --head <branch> \
  --title "..." --description "..."
```

## Notes

- Forgejo's REST API does not expose a stable logs endpoint, so use `scripts/ci-logs`.
- `tea api` expects full `/api/v1/...` paths.
- The internal job log endpoint uses a 1-based job index within each run, not the global task ID.
