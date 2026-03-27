---
name: svc-deploy
description: Deploy a new version of the Contfu service app. Use when the user says "deploy", "bump the service version", "release a new version", "svc-deploy", or wants to push a new app version to the cluster.
---

## What This Skill Does

Bumps the service app version, waits for CI to build the Docker image, then bumps the Helm chart so Flux deploys the new version to the K3S cluster.

This workflow pushes two separate commits directly to main (no PR).

## Steps

1. **Read current versions**
   - Read `packages/service/app/package.json` for the current app version
   - Read `helm/contfu/Chart.yaml` for the current chart `version` and `appVersion`

2. **Bump the app version**
   - Increment the patch version in `packages/service/app/package.json`
   - Commit: `chore: bump @contfu/svc-app to <new-version>`
   - `git pull --rebase` if needed, then `git push`

3. **Wait for CI to build the Docker image**
   - Run `.claude/skills/forgejo/scripts/ci-status` to find the latest run ID
   - Run `.claude/skills/forgejo/scripts/ci-wait <run_id>` (timeout up to 600s)
   - If CI fails, stop and report the failure to the user. Use `.claude/skills/forgejo/scripts/ci-logs` to show relevant errors.

4. **Bump the Helm chart**
   - In `helm/contfu/Chart.yaml`:
     - Increment `version` (chart version, patch bump)
     - Set `appVersion` to match the new app version from step 2
   - Commit: `chore: bump helm chart to <chart-version> / appVersion <app-version>`
   - `git pull --rebase` if needed, then `git push`

5. **Confirm deployment**
   - Tell the user: Flux will reconcile the new version on the cluster (context `ce`, namespace `contfu`).

## Notes

- Always push directly to main -- no branch, no PR.
- The Helm chart bump MUST wait until CI succeeds. The Docker image must exist before Flux tries to pull it.
- Both commits go to main sequentially. This is intentional and overrides the "one commit per PR" rule in CLAUDE.md since this is not a PR workflow.
- Use `git pull --rebase` before each push to avoid non-fast-forward rejections.
