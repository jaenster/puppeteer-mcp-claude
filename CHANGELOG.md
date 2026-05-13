# Changelog

All notable changes to this project will be documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/) and the project adheres to [SemVer](https://semver.org/).

## [0.2.2] — 2026-05-13

Pure metadata / docs release — no code changes versus v0.2.1.

### Changed
- Tightened npm + GitHub repo description.
- Expanded npm keywords from 5 to 15 (`claude-code`, `claude-desktop`, `anthropic`, `chromium`, `headless-chrome`, `web-scraping`, `screenshot`, etc.).
- Added README badges (npm version, downloads, CI status, Node version, license).
- Cross-linked the other MCP servers in this family ([remote-shell-mcp](https://github.com/jaenster/remote-shell-mcp), [node-debugger-mcp](https://github.com/jaenster/node-debugger-mcp)).
- CHANGELOG.md added to the npm tarball so it renders on the package page.
- GitHub repo topics, homepage, and description set via API.

## [0.2.1] — 2026-05-13

### Fixed
- `bin/cli.mjs serve` now runs the MCP server **in-process** via dynamic `import()` instead of spawning a child. The previous shim swallowed `SIGINT` / `SIGTERM` from the host (Claude Code's MCP launcher), so the server's cleanup handler never ran and Chromium was orphaned on every shutdown. Bug shipped with v0.2.0; caught by a fresh-from-npm smoke test.
- `tests/e2e/run-all.mjs` now dual-passes by default — once against `dist/index.js`, once via `node bin/cli.mjs serve` — so this class of regression is caught locally, not only in CI.

## [0.2.0] — 2026-05-13

A full modernisation pass. The tool API (names + argument shapes) is preserved; everything below it is rewritten.

### Added
- **Lazy browser launch + default page id.** The browser auto-launches with sane defaults on first tool call; `pageId` defaults to `"default"`. Single-tab flows no longer need an explicit `puppeteer_launch` or `puppeteer_new_page`.
- **Image content for screenshots.** `puppeteer_screenshot` now returns an MCP `image` content block (base64 PNG) alongside the structured metadata, so Claude can actually see the result inline.
- **[TOON](https://toonformat.dev)-encoded responses.** Every tool response uses [Token-Oriented Object Notation](https://toonformat.dev) for the wire `content[0].text`, plus the same data on `structuredContent` for typed MCP clients.
- **One-shot installers.** `install.sh` (macOS / Linux) and `install.ps1` (Windows) — `curl … | bash` or `iwr … | iex` and the server is registered with Claude Code at user scope.
- **`puppeteer-mcp-claude chrome`** subcommand to launch Chrome with remote debugging, ready for `puppeteer_launch({ browserWSEndpoint: "ws://localhost:9222" })`.
- 184 unit tests on `node:test` + 4 E2E files (~70 assertions) covering every handler against real Chromium, error paths, launch options (UA / viewport / stealth / args / WS endpoint), and SIGINT cleanup.
- CI matrix on Ubuntu / macOS / Windows, plus a tarball-install job that runs E2E against the globally-installed binary on each OS, plus a `claude mcp add` regression job that re-proves the issue #7 fix on every PR.

### Changed
- **MCP SDK v1 + Zod.** Rewrote the server from the low-level `Server` + `setRequestHandler(CallToolRequestSchema, …)` pattern to `McpServer.registerTool(…)` with Zod input schemas. The giant `switch` dispatcher is gone.
- **ESM throughout.** `"type": "module"`, `tsconfig` set to `NodeNext`, `bin/cli.mjs` is now an ESM file.
- **`node:test` via `tsx`** replaces vitest. Zero runtime deps for the test runner; tests run with `tsx --test`.
- **`puppeteer_evaluate` returns the raw JS value** on `structuredContent.result` (previously `JSON.stringify(result)` only in the text body).
- **`puppeteer-mcp-claude install`** now runs `claude mcp add … -- npx -y puppeteer-mcp-claude serve` (self-healing across upgrades), matching the form documented in the README.
- **Server reports its version from `package.json`** at runtime — no more hardcoded version drift between source and tag.

### Fixed
- **#7** — the install command no longer fails with `error: missing required argument 'commandOrUrl'`. The legacy `claude mcp add <name>` form was replaced everywhere (README, installer scripts, `bin/cli.mjs install`) with the modern `-- <command>` form. CI now keeps it that way.
- **Stealth mode was a no-op for the entire history of the package.** The stealth shim was passed to `page.evaluateOnNewDocument(...)` as the *string* `'() => { … }'`, which evaluated to a defined-but-never-called arrow function. Now passed as a real function value so Puppeteer serialises and invokes it. `navigator.webdriver` is genuinely `undefined` in stealth mode.
- **Launch options didn't apply to lazy-created pages.** `userAgent` / `stealth` / `viewport` from `puppeteer_launch` only touched the browser's initial blank tab; the auto-page flow opened a fresh tab that skipped them. New `applyPageDefaults()` helper applies them to every page (initial, lazy, and explicit `puppeteer_new_page`).
- **Race in `ensureBrowser` / `ensurePage`** — two concurrent `tools/call` requests could each launch their own Chromium (or open their own tab) before the other resolved, leaking the loser. Both functions now cache an in-flight Promise so concurrent callers share the same launch / page.
- **`puppeteer_set_request_interception` stacked listeners.** Repeat calls on the same page registered additional `'request'` handlers; the second handler crashed with "Request is already handled!". Old listeners are now removed before a new one is registered.
- **`puppeteer_new_page` silently leaked tabs.** Calling with an existing pageId overwrote the Map entry without closing the old page. Now rejects with a clear error.
- **`SIGTERM` is now handled** (was `SIGINT` only). Cleanup paths are guarded so concurrent triggers don't double-close.
- **`respond()` no longer crashes on circular references** — TOON encode is wrapped with a JSON-with-replacer fallback.

### Removed
- `ts-node` and `@types/node` moved out of runtime `dependencies` (they belonged in `devDependencies`).
- Several overlapping hand-rolled test scripts (`tests/claude-integration.ts`, `tests/real-claude-test.ts`, `tests/console-claude-test.ts`, `tests/e2e.ts`, `tests/claude-simple-test.ts`, `test-mcp-direct.js`).
- `TESTING.md`, `claude-config.json`, the stray test PNGs, the `PuppeteerMCPInstaller` class with its multi-file Claude Desktop config writing.

## [0.1.10] and earlier

Original release line. See `git log v0.1.10` for the history.

[0.2.2]: https://github.com/jaenster/puppeteer-mcp-claude/releases/tag/v0.2.2
[0.2.1]: https://github.com/jaenster/puppeteer-mcp-claude/releases/tag/v0.2.1
[0.2.0]: https://github.com/jaenster/puppeteer-mcp-claude/releases/tag/v0.2.0
