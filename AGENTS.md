Make sure you create only one commit per PR which is up-to-date with the remote main branch. When required, amend it with the correct commit message.

Track issues in the [project](https://github.com/orgs/contfu/projects/1). Always keep the state in sync with the implementation state.

Unit tests are called `*.spec.ts`, not `*.test.ts`.

The user manages the dev server. If backend changes need a server restart to take effect, say so explicitly — don't restart it yourself.

When moving code between packages, update each consuming file to import directly from the new source. Do not add re-export shims in the old location — find all usages and fix them.
