---
name: forgejo
description: Interact with the Forgejo instance at code.sven-rogge.com — check CI run status, fetch job logs, manage PRs via tea CLI. Use when watching CI checks, debugging workflow failures, or creating PRs on Forgejo.
model: haiku
---

# Forgejo

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Configuration

Credentials come from `.env`:

```
FORGEJO_USERNAME=<username>
FORGEJO_PASSWORD=<password>
FORGEJO_URL=https://code.sven-rogge.com    # optional override
FORGEJO_REPO=contfu/contfu                 # optional override
```

The session cookie is cached in `.forgejo-session` (gitignored) and auto-refreshed. The `tea` CLI uses a stored PAT (`tea login list` → `forgejo`).

## Login

Run once (or any time the session expires):

```bash
.claude/skills/forgejo/scripts/forgejo-login
```

This reads `FORGEJO_USERNAME` and `FORGEJO_PASSWORD` from `.env`, logs in to Forgejo via the web form (handling CSRF), and saves the session cookie to `.forgejo`. The `ci-logs` script calls this automatically when the session is invalid.

## Scripts

Run from the repo root.

### forgejo-token

Prints the Forgejo PAT from the tea CLI config. Used by other scripts internally.

```bash
TOKEN=$(.claude/skills/forgejo/scripts/forgejo-token)
```

### forgejo-label {add|remove|set-status} \<issue\> \<label\>

Manage labels on issues. `set-status` removes all status labels (ready, in-progress, done) and adds the given one.

```bash
.claude/skills/forgejo/scripts/forgejo-label add 3 enhancement
.claude/skills/forgejo/scripts/forgejo-label remove 3 bug
.claude/skills/forgejo/scripts/forgejo-label set-status 3 in-progress
```

Known labels: `bug` (1), `enhancement` (2), `documentation` (3), `ready` (4), `in-progress` (5), `done` (6).

### ci-status [run_id]

Shows job status for the latest run (or a specific run):

```bash
.claude/skills/forgejo/scripts/ci-status
.claude/skills/forgejo/scripts/ci-status 5
```

Output:

```
Run #5
✅ Lint & Unit Tests (success)
❌ Build & E2E Tests (failure)
🔄 Build Docker image (running)
```

### ci-wait [run_id] [--timeout <seconds>]

Polls until a run reaches a settled state (success/failure/cancelled). Defaults to the latest run. Exits 0 on success, 1 on failure. Default timeout: 600s.

```bash
.claude/skills/forgejo/scripts/ci-wait          # wait for latest run
.claude/skills/forgejo/scripts/ci-wait 5        # wait for run #5
.claude/skills/forgejo/scripts/ci-wait --timeout 300
```

Output:

```
Waiting for run #5 (timeout: 600s)...
--- Run #5 @ 0s ---
🔄 Lint & Unit Tests (running)
⏳ Build & E2E Tests (waiting)
--- Run #5 @ 45s ---
✅ Lint & Unit Tests (success)
🔄 Build & E2E Tests (running)

Run #5 completed: success
```

### ci-logs <run_id> [job_index] [-v]

Fetches logs for a job. `job_index` is 1-based within the run (default: 1). Add `-v` for full verbose output. Auto-logins if session is expired.

```bash
.claude/skills/forgejo/scripts/ci-logs 5 1        # errors only
.claude/skills/forgejo/scripts/ci-logs 5 1 -v     # full log
```

**Job index mapping** (jobs within a run are ordered by creation, index 1 = first job that ran):

- Use `ci-status` to see job names, then match by order.
- Index 2 sometimes triggers a Forgejo 500 bug — try 1 and 3 first.

## tea CLI

### List runs

```bash
tea actions runs --login forgejo --repo contfu/contfu
```

### List tasks (with job names + status)

```bash
tea api --login forgejo "/api/v1/repos/contfu/contfu/actions/tasks?run_id=<id>"
```

### Create PR

```bash
tea pr create --login forgejo --repo contfu/contfu \
  --base main --head <branch> \
  --title "..." --description "..."
```

## Forgejo API Notes

- **No logs endpoint in API** — Forgejo's REST API (`/swagger.v1.json`) has no `/runs/{id}/logs` or `/jobs/{id}/logs` endpoint. Use the `ci-logs` script (internal web endpoint) instead.
- **`GITHUB_TOKEN` cannot pull from the Forgejo container registry** — even with `permissions: packages: read`. Use a PAT stored as `REGISTRY_TOKEN` secret for `credentials:` in workflows.
- **Service container `credentials:` is broken** — works for the main `container:` but fails for `services:`. Workaround: start services inline as steps, or make images public.
- **`tea api` requires full path** — use `/api/v1/repos/...` not `repos/...`.
- **Job index in web endpoint** — the internal endpoint `/actions/runs/{run_id}/jobs/{job_index}/attempt/1` uses a 1-based index local to the run, not the global task ID.
- **Cursor count must not exceed step count** — requesting more `logCursors` entries than the job has steps returns HTTP 500. The `ci-logs` script handles this with a probe request.

## Current Run Status

!`.claude/skills/forgejo/scripts/ci-status`
