<!-- A few sentences are usually enough. Long PR descriptions don't get read. -->

## What this changes

<!-- The behavioural diff. "Adds X", "fixes Y", "renames Z". One or two lines. -->

## Why

<!-- The motivation. Link to an issue if there is one. -->

## How to verify

<!-- A reviewer should be able to convince themselves this works without
re-running the whole test matrix. List the specific commands or scenarios. -->

- [ ] `pnpm test` passes
- [ ] `pnpm test:e2e` passes (against real Chromium, both direct + bin-shim modes)
- [ ] CHANGELOG.md updated if user-visible behaviour changed
- [ ] README updated if tool surface, install flow, or response shape changed
