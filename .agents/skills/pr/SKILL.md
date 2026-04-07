---
name: pr
description: Create a pull request following the Contfu workflow. Use when changes are complete, should be consolidated into one commit, pushed, and opened as a Forgejo PR.
---

# PR Workflow

Create a Forgejo pull request following the repo's single-commit PR workflow.

## Commands

Inspect branch and status:

```bash
git branch --show-current
git status --short
```

Inspect recent commits:

```bash
git log --oneline -5
```

Inspect the latest commit diff:

```bash
git diff HEAD~1...HEAD --stat
```

## Workflow

1. Ensure the branch is up to date with `origin/main`.
2. Ensure there is exactly one commit for the PR. Use a non-interactive squash strategy if consolidation is required.
3. Push the branch:

   ```bash
   git push -u origin HEAD
   ```

   If the branch already exists remotely, use:

   ```bash
   git push --force-with-lease
   ```

4. Link matching Forgejo issues in the PR description.
5. Create the PR:

   ```bash
   tea pr create --login forgejo --repo contfu/contfu \
     --base main --head "$(git branch --show-current)" \
     --title "<title>" --description "$(cat <<'EOF'
   ## Summary

   - <change 1>
   - <change 2>

   Closes #<issue-number>
   EOF
   )"
   ```

6. Wait for CI:

   ```bash
   ../forgejo/scripts/ci-wait
   ```

7. If CI fails, inspect logs, fix the issue, amend the existing commit, and force-push with lease:

   ```bash
   ../forgejo/scripts/ci-status
   ../forgejo/scripts/ci-logs <run_id> <job_index>
   git commit --amend
   git push --force-with-lease
   ```

## Rules

- A PR must have exactly one commit.
- Never force-push to `main`.
- When the PR is already open, keep updating the same commit with `git commit --amend`.
- Keep PR titles and commit subjects imperative and focused on the end-state change.
