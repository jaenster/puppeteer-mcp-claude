# Contributing

Thanks for your interest. The project is small and deliberately so — bug fixes, edge-case test coverage, and small additive tools are the easiest things to land.

## Dev loop

```bash
git clone https://github.com/jaenster/puppeteer-mcp-claude.git
cd puppeteer-mcp-claude
pnpm install
pnpm build
pnpm test          # 184 unit tests, ~500ms
pnpm test:e2e      # 4 E2E files, real Chromium, dual-pass (direct + bin shim), ~13s
```

Run the server straight from source while iterating:

```bash
pnpm dev           # tsx src/index.ts
```

## What lands easily

- **Bug fixes** with a regression test (unit or E2E).
- **Test coverage for an existing handler.** If you find a code path that isn't tested, a PR with a focused test is welcome on its own.
- **New tools** that match the existing shape — Zod schema in `src/tools.ts`, handler in `src/handlers/`, unit test, optional E2E.
- **Docs and examples.** Especially examples in the README that show realistic LLM prompts.

## What's harder to land

- **Large refactors** without a concrete bug or perf wins to point at.
- **New runtime dependencies.** The dep list is short on purpose. If you need a new one, please open an issue first explaining why.
- **Changes to the tool API** (tool names or argument shapes). They're contract; bump the major version intentionally.

## House style

- TypeScript strict; no `any` except at the SDK seam (`src/tools.ts`'s `tool<TArgs>` wrapper) — explained in the comment there.
- No comments that just narrate code. Prefer comments that explain "why" or flag non-obvious invariants.
- Tests use `node:test` via `tsx`. Don't introduce vitest, jest, or any other runner.
- Don't add `console.log` for debugging; use the existing `log()` function — output goes to `~/.puppeteer-mcp-logs/` so it doesn't pollute MCP stdout.

## PR mechanics

1. Branch from `main`.
2. `pnpm test` and `pnpm test:e2e` should pass before pushing.
3. Update `CHANGELOG.md` under an `## [Unreleased]` heading if the change is user-visible.
4. Use the PR template — short body is fine; reviewers look at the diff, not the prose.

## Reporting

- Bugs → [Issues](https://github.com/jaenster/puppeteer-mcp-claude/issues/new/choose), use the bug-report template (it asks for the things triage actually needs).
- Questions / how-do-I → [Discussions](https://github.com/jaenster/puppeteer-mcp-claude/discussions). The pinned FAQ covers most setup pitfalls.
- Security → [private vulnerability report](https://github.com/jaenster/puppeteer-mcp-claude/security/advisories/new); see [SECURITY.md](SECURITY.md).
