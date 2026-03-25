---
name: update-deps
description: >
  Update all npm/bun dependencies to their latest compatible versions. Use when someone
  asks to update dependencies, bump packages, run a dep update, or says "/update-deps".
  Covers the full workflow: bulk update, out-of-range bumps, syncing all package.json
  files, researching wins and breaking changes, verifying impact, and opening a PR.
disable-model-invocation: true
---

# update-deps

Full dependency update workflow for the Contfu monorepo. Runs `bun update`, syncs every
sub-package.json, researches breaking changes and wins, verifies codebase impact, and
opens a PR.

## Workspace layout

```
packages/client/*   packages/service/*   packages/cli   packages/core   packages/ui
demos/*
```

---

## Step 1 — Bulk in-range update

```bash
bun update
```

This updates the lock file AND root `package.json` version ranges for all workspaces.
Note what changed (check `git diff package.json`).

---

## Step 2 — Find and apply out-of-range minor/patch bumps

Run `bun outdated` at root and per workspace:

```bash
bun outdated
for dir in packages/client/* packages/service/* packages/cli packages/core packages/ui demos/*; do
  echo "=== $dir ===" && cd "$dir" && bun outdated 2>&1; cd -
done
```

For any package where **Latest > Update** (i.e. a newer minor/patch exists outside the
declared range), manually bump the version range in the relevant `package.json`.

**Skip entirely if Latest is a major version bump** (e.g. typescript 5→6, vite 7→8,
lucide 0.x→1.x). Create a separate Forgejo issue for those instead (use the `issues`
skill).

---

## Step 3 — Sync ALL sub-package.json version ranges (CRITICAL)

`bun update` only updates the root `package.json`. All sub-packages still declare stale
ranges. Fix them:

1. For every `packages/*/package.json` and `demos/*/package.json`, compare declared
   ranges against what is now in `bun.lock`.
2. For each package that was updated, bump the lower bound of the range to match the
   newly installed version.
3. Run `bun install` after ALL package.json edits (steps 2 + 3) to regenerate the lock file.
4. CI uses `--frozen-lockfile` — the lock file MUST be committed and in sync or the entire pipeline fails at install.

**Do not update** `vite` or `@sveltejs/vite-plugin-svelte` if a tracking issue already
exists for that major upgrade.

---

## Step 4 — Research: breaking changes and wins

Launch **two parallel web-research agents** — one for breaking changes, one for wins.
Focus only on packages with **minor or greater** version bumps. Patch-only updates can
be skipped.

### Agent A — Breaking changes

For each significantly updated package, fetch its changelog/GitHub releases and extract:

- Removed or renamed APIs
- Behavior changes
- Deprecated imports or config options
- New lint rules that are now enabled by default (for linting tools)

### Agent B — Wins

For each significantly updated package, extract:

- Notable new features relevant to this codebase
- Performance improvements
- DX improvements

### Present findings to the user

Show a **Breaking changes** section and a **Wins** section before proceeding.
Wait for the user to acknowledge before continuing to Step 5.

---

## Step 5 — Verify breaking changes against the codebase

For each breaking change identified in Step 4:

1. **Grep the codebase** for the affected API, import path, or config option.
2. Report which ones are **applicable** (used in code) vs **not applicable**.
3. For applicable ones:
   - Fix immediately if the fix is small and safe (e.g. adding `await`, updating an
     import path, removing a deleted config option).
   - Flag for the user if the fix requires non-trivial changes.

Show a verification table:

| Breaking change      | Used? | Action taken                  |
| -------------------- | ----- | ----------------------------- |
| `foo` import moved   | No    | —                             |
| `bar` option removed | Yes   | Fixed in `path/to/file.ts:42` |

---

## Step 6 — Quality checks

```bash
bun run fmt
bun run lint:types
bun test
```

Fix any failures that were **introduced by the update** (not pre-existing). Pre-existing
failures can be noted but should not block the PR.

---

## Step 7 — Create PR

Use the `pr` skill:

```
/pr
```

The PR title should follow: `chore: update dependencies to latest compatible versions`.

The PR description should include:

- A bullet list of the most significant package updates (version A → B)
- The major-version packages that were intentionally **skipped** and why
- A note that all tests pass

---

## Rules

- **Never update major versions** in this skill. Create a separate issue for each one.
- **Always update all package.json files**, not just root — sub-packages must stay in sync.
- **Always present wins and breaking changes** before creating the PR.
- **Always verify breaking changes** against actual codebase usage — don't just report them.
- **Fix lint/test regressions** caused by the update before opening the PR.
- Use parallel agents for changelog research to keep the session fast.

## Known migrations (update as needed)

- **better-auth ≥1.5.0**: `apiKey` moved from `better-auth/plugins` → `@better-auth/api-key`;
  `apiKeyClient` moved from `better-auth/client/plugins` → `@better-auth/api-key/client`.
  Add `@better-auth/api-key` as a dependency wherever the plugin is used.
