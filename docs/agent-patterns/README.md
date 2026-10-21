# Agent patterns

The patterns this repository uses for Effect code, written down so that agents (and people) do not
have to rediscover them. Each section names the modules that show the pattern; those modules are
the source of truth, so when they change, update the pattern file in the same PR.

Upstream references live in `repos/effect` (the Effect source, read-only, fetched with
`bun run repos:sync`, shared by all git worktrees through a symlink), see `AGENTS.md`.

| File                                     | Covers                                                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| [effect-services.md](effect-services.md) | `Context.Service`, layers, live/fake wiring, `Config`      |
| [effect-errors.md](effect-errors.md)     | Tagged errors, `catchTag`, `Effect.tryPromise` at the edge |
| [effect-running.md](effect-running.md)   | Running effects from Promise code, runtimes, specs         |
