#!/usr/bin/env bash
# puppeteer-mcp-claude — one-shot installer for macOS / Linux
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/jaenster/puppeteer-mcp-claude/main/install.sh | bash
#
# Optional env vars:
#   SCOPE=user|project|local   Passed to `claude mcp add --scope` (default: user)

set -euo pipefail

PKG="puppeteer-mcp-claude"
SCOPE="${SCOPE:-user}"

step() { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "$1 is required but not found in PATH."
    [ -n "${2:-}" ] && printf '  %s\n' "$2" >&2
    exit 1
  fi
}

step "Checking prerequisites"
require_cmd node "Install Node.js >= 18 from https://nodejs.org"
require_cmd npm
require_cmd claude "Install Claude Code from https://claude.com/claude-code"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js >= 18 required (found $(node -v))."
  exit 1
fi
ok "node $(node -v), npm $(npm -v), claude $(claude --version 2>/dev/null | head -1)"

step "Installing $PKG globally via npm"
npm install -g "$PKG"
ok "$PKG installed"

step "Registering with Claude Code (scope: $SCOPE)"
claude mcp add --scope "$SCOPE" "$PKG" -- npx -y "$PKG" serve
ok "Registered"

echo
ok "Done. Restart any running Claude Code session, then ask:"
echo "    \"Take a screenshot of example.com\""
