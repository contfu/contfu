# Learnings & Process Improvements

Load this to avoid repeating past mistakes.

## Code Changes

- **Minimal changes only**: Make the smallest possible change. Don't refactor unless asked.
- **Ask before large changes**: Present a plan first for architectural changes.
- **Forks often have identical APIs**: When migrating packages (e.g., `notion-client-web-fetch` → `@notionhq/client`), check if API is identical. Often just need to change the import path.

## Notion Integration

- **Single client instance**: Use one shared `Client` instance, pass `auth` per request
- **Use SDK helpers**: Use `iteratePaginatedAPI`, `isFullPage`, `isFullBlock` from `@notionhq/client` instead of reimplementing

## Skills Maintenance

When modifying core code, update the corresponding skill:

| Code Change | Update Skill |
|-------------|--------------|
| `packages/core/src/` types | `contfu-content-modeling` |
| Database schemas | `contfu-content-modeling` |
| Source adapters | `contfu-source-adapter` |
| UI components | `contfu-design` |
| Dev workflow | `contfu-development` |
