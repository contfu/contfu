---
name: review
description: Review code changes for bugs, security issues, missing tests, and convention violations. Use when someone asks to review changes, review a branch, check code quality, or says "review my changes". Also runs automatically before PR creation.
model: sonnet
---

# Code Review

Review the current branch's changes against main and fix any issues found.

## Steps

1. **Get the diff.** Run `git diff main...HEAD` and identify all changed files.

2. **Read all changed files in full** (not just the diff hunks). Understanding the surrounding code is critical for catching real bugs vs false positives.

3. **Review against these categories** (in priority order):
   - **Bugs** -- Logic errors, off-by-one, null/undefined access, race conditions, wrong return types
   - **Security** -- Injection (SQL, XSS, command), auth bypasses, secrets in code, OWASP top 10
   - **Missing tests** -- New logic without corresponding `*.spec.ts` coverage
   - **Convention violations** -- Check against CLAUDE.md rules and existing patterns in the codebase
   - **Suggestions** -- Simplifications, dead code, naming improvements (only if meaningful)

4. **Fix all bugs and security issues directly.** Edit the files to resolve them. Run `bun test && bun run fmt && bun run lint` after fixes to verify nothing breaks.

5. **Write the review report** to `.claude/review.md` using this format:

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

   If there are no findings, write: "No issues found."

6. **Stage the fixes** (if any were made) but do NOT commit. The PR skill will handle committing.

## Rules

- **Fix bugs and security issues directly.** Don't just report them — fix them.
- **Skip style and formatting.** The project uses oxlint and oxfmt -- don't flag whitespace, semicolons, import order, or brace style.
- **Don't nitpick.** Only flag things that matter. If you're unsure whether something is a problem, skip it.
- **Be specific.** Every finding must reference the exact file and line and explain WHY it's a problem.
- **Group related issues.** If the same pattern repeats across files, mention it once rather than listing every instance.
- **Read CLAUDE.md first.** The project conventions are defined there.
