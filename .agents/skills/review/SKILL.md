---
name: review
description: Review code changes for bugs, security issues, missing tests, and convention violations. Use when someone asks to review changes, review a branch, or check code quality before merge.
---

# Code Review

Review the current branch against `main` and fix any clear correctness or security issues found.

## Commands

List changed files:

```bash
git diff --name-only main...HEAD
```

Show the diff:

```bash
git diff main...HEAD
```

## Steps

1. Identify all changed files.
2. Read each changed file in full, not just the diff hunks.
3. Review in this priority order:
   - bugs
   - security issues
   - missing `*.spec.ts` coverage for new non-trivial logic
   - convention violations against [AGENTS.md](/Users/svenrogge/projects/business/contfu/AGENTS.md)
   - high-signal suggestions
4. Fix bugs and security issues directly.
5. Run verification after fixes: `bun test && bun run fmt && bun run lint`.
6. Write the review report to `.tmp/review.md` in this format:

   ```markdown
   # Code Review

   **Branch:** <branch-name>
   **Date:** <YYYY-MM-DD>
   **Reviewed files:** <count>

   ## Fixed

   - **[Bug]** `path/to/file.ts:42` — Description of what was wrong and how it was fixed
   - **[Security]** `path/to/file.ts:56` — Description of vulnerability and the fix applied

   ## Findings

   - **[Missing test]** `path/to/file.ts` — Description of what needs test coverage
   - **[Convention]** `path/to/file.ts:10` — Description of the violation
   - **[Suggestion]** `path/to/file.ts:25` — Description of the improvement

   ## Summary

   <one-sentence overall assessment>
   ```

7. Stage any direct fixes, but do not commit them here.

## Rules

- Fix real bugs and security issues directly instead of only reporting them.
- Skip formatting nits and low-signal style commentary.
- Every finding should reference an exact file and line and explain why it matters.
- If there are no findings, say so explicitly in the report.
