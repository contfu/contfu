Make sure you create only one commit per PR which is up-to-date with the remote main branch. When required, amend it with the correct commit message.

Track issues in the [project](https://github.com/orgs/contfu/projects/1). Always keep the state in sync with the implementation state.

Unit tests are called `*.spec.ts`, not `*.test.ts`.

The user manages the dev server. If backend changes need a server restart to take effect, say so explicitly — don't restart it yourself.

`@contfu/svc-backend` exports from `dist/` (not source). Changes to its source files require `bun run --filter '@contfu/svc-backend' build` before the dev server picks them up. `@contfu/svc-core` and `@contfu/svc-app` resolve directly to source, so no rebuild is needed for those.
