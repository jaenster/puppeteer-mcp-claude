# Security policy

## Reporting a vulnerability

If you find a security issue in `puppeteer-mcp-claude`, please **don't** open a public GitHub issue. Instead, use GitHub's [private vulnerability reporting](https://github.com/jaenster/puppeteer-mcp-claude/security/advisories/new) — it lets us discuss and patch before going public.

Include:
- Affected version(s).
- Reproduction steps.
- Impact assessment.

You should expect an initial response within a few days. Fixes for confirmed issues will be released as a patch version with credit to the reporter (unless you'd rather stay anonymous).

## Scope

This package runs as a local stdio MCP server. It executes JavaScript in a controlled Chromium instance launched by Puppeteer and exposes those capabilities to an MCP client (typically an LLM agent). The expected threat model is:

- **In scope:** issues that let an MCP client read or write data outside the intended browser sandbox (e.g. host filesystem access via path-traversal in `puppeteer_screenshot`'s `path` argument, prototype pollution in the response builder, code injection via argument parsing).
- **Out of scope:** anything a tool is *designed* to do — `puppeteer_evaluate` runs arbitrary JS in a browser context by design; the security boundary is "your MCP client trusts the prompts you give it".

If you're unsure whether a finding is in scope, report it anyway.
