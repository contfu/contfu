---
name: svc-deploy
description: Deploy a new version of the Contfu service app. Use when the user wants to bump the service version, wait for CI to publish the image, and then deploy the new version through the Helm chart.
---

## What This Skill Does

Bump the service app version, wait for CI to build the Docker image, then bump the Helm chart so Flux deploys the new version to the K3S cluster.

This workflow pushes two separate commits directly to `main`, so it is intentionally outside the normal PR flow.

## Steps

1. Read current versions from `packages/service/app/package.json` and `helm/contfu/Chart.yaml`.
2. Bump the app version and commit `chore: bump @contfu/svc-app to <new-version>`.
3. Push the version bump, then load the `forgejo` skill and use it to watch the CI run until it succeeds. If CI fails, use the same skill to inspect run status and logs before continuing.
4. Bump `helm/contfu/Chart.yaml`:
   - increment the chart `version`
   - set `appVersion` to the new service version
   - commit `chore: bump helm chart to <chart-version> / appVersion <app-version>`
5. Push the chart bump.
6. Force Flux reconciliation:

   ```bash
   flux reconcile source git contfu --context ce -n contfu
   flux reconcile helmrelease contfu --context ce -n contfu
   flux get helmreleases contfu --context ce -n contfu
   ```

7. Confirm the deployed app version and report completion to the user.

## Notes

- Always wait for the image build CI to succeed before bumping the chart.
- Use `git pull --rebase` before each push if needed.
- This workflow is intentionally not a one-commit PR flow.
