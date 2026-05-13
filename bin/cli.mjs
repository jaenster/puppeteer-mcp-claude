#!/usr/bin/env node

import { execSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_NAME = 'puppeteer-mcp-claude';
const PACKAGE_DIR = dirname(__dirname);
const SERVER_ENTRY = join(PACKAGE_DIR, 'dist', 'index.js');

function hasClaudeCli() {
  const which = spawnSync(platform() === 'win32' ? 'where' : 'which', ['claude'], {
    stdio: 'ignore',
  });
  return which.status === 0;
}

function runClaude(args) {
  return spawnSync('claude', args, { stdio: 'inherit' });
}

function parseScope(argv) {
  const idx = argv.indexOf('--scope');
  if (idx === -1) return undefined;
  const value = argv[idx + 1];
  if (!value) {
    console.error('--scope requires a value (user|project|local)');
    process.exit(1);
  }
  return value;
}

function install({ scope }) {
  if (!hasClaudeCli()) {
    console.error('claude CLI not found in PATH. Install Claude Code first: https://claude.com/claude-code');
    process.exit(1);
  }

  // Register via `npx -y <pkg> serve` so the registration self-heals across
  // package upgrades and global-prefix changes. Matches what the README and
  // install.sh / install.ps1 scripts emit.
  const args = ['mcp', 'add'];
  if (scope) args.push('--scope', scope);
  args.push(SERVER_NAME, '--', 'npx', '-y', SERVER_NAME, 'serve');

  console.log(`> claude ${args.join(' ')}`);
  const result = runClaude(args);
  if (result.status !== 0) process.exit(result.status ?? 1);

  console.log('\nInstalled. Restart any running Claude Code session, then ask:');
  console.log('  "Take a screenshot of example.com"');
}

function uninstall({ scope }) {
  if (!hasClaudeCli()) {
    console.error('claude CLI not found in PATH.');
    process.exit(1);
  }
  const args = ['mcp', 'remove'];
  if (scope) args.push('--scope', scope);
  args.push(SERVER_NAME);
  console.log(`> claude ${args.join(' ')}`);
  const result = runClaude(args);
  process.exit(result.status ?? 0);
}

function status() {
  if (!hasClaudeCli()) {
    console.error('claude CLI not found in PATH.');
    process.exit(1);
  }
  const result = runClaude(['mcp', 'list']);
  process.exit(result.status ?? 0);
}

function serve() {
  if (!existsSync(SERVER_ENTRY)) {
    console.error(`Server build not found at ${SERVER_ENTRY}. Did "npm run build" complete?`);
    process.exit(1);
  }
  const child = spawn('node', [SERVER_ENTRY], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

function chrome(port, userDataDir) {
  const os = platform();
  const home = homedir();
  let chromePath;

  if (os === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    chromePath = candidates.find((p) => existsSync(p));
  } else if (os === 'linux') {
    for (const bin of ['google-chrome', 'chromium-browser', 'chromium']) {
      try {
        chromePath = execSync(`which ${bin}`, { encoding: 'utf8' }).trim();
        if (chromePath) break;
      } catch {
        // keep trying
      }
    }
  } else if (os === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      join(home, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    ];
    chromePath = candidates.find((p) => existsSync(p));
  }

  if (!chromePath) {
    console.error('Chrome/Chromium not found. Install Chrome and try again.');
    process.exit(1);
  }

  const dataDir = userDataDir ?? join(home, '.chrome-debug-data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];

  console.log(`Launching Chrome with debug port ${port}`);
  console.log(`User data dir: ${dataDir}`);
  console.log(`Then call puppeteer_launch with browserWSEndpoint: "ws://localhost:${port}"\n`);

  const child = spawn(chromePath, args, { stdio: 'ignore', detached: true });
  child.unref();
  child.on('error', (err) => {
    console.error('Failed to start Chrome:', err.message);
    process.exit(1);
  });
}

function help() {
  console.log(`puppeteer-mcp-claude — browser automation MCP server

Usage:
  puppeteer-mcp-claude install [--scope user|project|local]   Register with Claude Code
  puppeteer-mcp-claude uninstall [--scope ...]                Remove from Claude Code
  puppeteer-mcp-claude status                                 Show "claude mcp list"
  puppeteer-mcp-claude serve                                  Run the MCP server on stdio
  puppeteer-mcp-claude chrome [port] [userDataDir]            Launch Chrome with remote debugging
  puppeteer-mcp-claude help                                   Show this message

One-shot installers:
  macOS / Linux: curl -fsSL https://raw.githubusercontent.com/jaenster/puppeteer-mcp-claude/main/install.sh | bash
  Windows:       iwr -useb https://raw.githubusercontent.com/jaenster/puppeteer-mcp-claude/main/install.ps1 | iex

Docs: https://github.com/jaenster/puppeteer-mcp-claude`);
}

function main() {
  const [, , command, ...rest] = process.argv;

  switch (command) {
    case 'install':
      return install({ scope: parseScope(rest) });
    case 'uninstall':
    case 'remove':
      return uninstall({ scope: parseScope(rest) });
    case 'status':
    case 'list':
      return status();
    case 'serve':
      return serve();
    case 'chrome':
      return chrome(rest[0] ? parseInt(rest[0], 10) : 9222, rest[1] ?? null);
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      return help();
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "puppeteer-mcp-claude help" for usage.');
      process.exit(1);
  }
}

main();
