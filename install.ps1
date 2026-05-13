# puppeteer-mcp-claude — one-shot installer for Windows (PowerShell)
#
# Usage:
#   iwr -useb https://raw.githubusercontent.com/jaenster/puppeteer-mcp-claude/main/install.ps1 | iex
#
# Optional environment variable:
#   $env:SCOPE = 'user' | 'project' | 'local'   (default: user)

$ErrorActionPreference = 'Stop'

$Pkg = 'puppeteer-mcp-claude'
$Scope = if ($env:SCOPE) { $env:SCOPE } else { 'user' }

function Step($msg) { Write-Host "▸ $msg" -ForegroundColor Blue }
function Ok($msg)   { Write-Host "✓ $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

function Require-Cmd($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Fail "$name is required but not found in PATH.`n  $hint"
  }
}

Step "Checking prerequisites"
Require-Cmd 'node'   'Install Node.js >= 18 from https://nodejs.org'
Require-Cmd 'npm'    ''
Require-Cmd 'claude' 'Install Claude Code from https://claude.com/claude-code'

$nodeMajor = [int](& node -p 'process.versions.node.split(".")[0]')
if ($nodeMajor -lt 18) { Fail "Node.js >= 18 required (found $(& node -v))." }
Ok "node $(& node -v), npm $(& npm -v)"

Step "Installing $Pkg globally via npm"
& npm install -g $Pkg
if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
Ok "$Pkg installed"

Step "Registering with Claude Code (scope: $Scope)"
& claude mcp add --scope $Scope $Pkg -- npx -y $Pkg serve
if ($LASTEXITCODE -ne 0) { Fail "claude mcp add failed." }
Ok "Registered"

Write-Host ""
Ok "Done. Restart any running Claude Code session, then ask:"
Write-Host '    "Take a screenshot of example.com"'
