// Shared helpers for E2E tests.
//
// Each test spawns the built MCP server (`dist/index.js`) and speaks raw
// JSON-RPC over its stdio pipes. A tiny local HTTP server is provided too,
// so tests that need a real origin (cookies, interception) don't depend on
// the public internet.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
export const repoRoot = join(dirname(__filename), '..', '..');
// Default to the local build, but allow CI / tarball tests to point at an
// installed copy via MCP_SERVER_ENTRY.
export const serverEntry =
  process.env.MCP_SERVER_ENTRY ?? join(repoRoot, 'dist', 'index.js');
// If set, takes precedence over MCP_SERVER_ENTRY. Space-separated argv used
// directly — e.g. "puppeteer-mcp-claude serve" or "npx -y puppeteer-mcp-claude serve".
export const serverCmd = process.env.MCP_SERVER_CMD;

export function spawnServer({ entry = serverEntry, cmd = serverCmd } = {}) {
  let child;
  if (cmd) {
    const [bin, ...rest] = cmd.split(/\s+/).filter(Boolean);
    child = spawn(bin, rest, { stdio: ['pipe', 'pipe', 'ignore'], cwd: repoRoot });
  } else {
    child = spawn('node', [entry], { stdio: ['pipe', 'pipe', 'ignore'], cwd: repoRoot });
  }

  const pending = new Map();
  let buf = '';
  let nextId = 1;

  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {
        // skip non-JSON lines
      }
    }
  });

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 60_000);
    });

  const notify = (method, params) =>
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');

  const initialize = async () => {
    const r = await call('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '0' },
    });
    notify('notifications/initialized');
    return r;
  };

  const callTool = async (name, args = {}) => {
    const r = await call('tools/call', { name, arguments: args });
    return r;
  };

  const kill = () => {
    try { child.kill('SIGTERM'); } catch {}
  };

  return { child, call, notify, callTool, initialize, kill };
}

/**
 * Spins up a local HTTP server with a few canned routes useful for E2E:
 *   GET /index.html — page with a form, button, delayed element, image
 *   GET /blocked.png — tiny PNG (used to test request interception)
 *   GET /set-cookie — sets `e2e=ok; Path=/`
 *   GET /404 — returns 404
 *
 * Returns { baseUrl, close } where baseUrl is like http://127.0.0.1:54321
 */
export function startTestHttpServer() {
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );
  const server = createServer((req, res) => {
    if (req.url === '/index.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(
        `<!doctype html>
<html><head><title>E2E</title></head>
<body>
  <h1 id="title">Welcome</h1>
  <input id="name" type="text" placeholder="name">
  <button id="submit" onclick="document.getElementById('result').textContent='clicked: '+document.getElementById('name').value">Submit</button>
  <div id="result"></div>
  <p id="delayed" style="display:none">Delayed</p>
  <img id="img" src="/blocked.png" alt="img">
  <script>
    setTimeout(() => {
      const el = document.createElement('p');
      el.id = 'late';
      el.textContent = 'late!';
      document.body.appendChild(el);
    }, 200);
  </script>
</body></html>`
      );
    } else if (req.url === '/blocked.png') {
      res.setHeader('content-type', 'image/png');
      res.end(tinyPng);
    } else if (req.url === '/set-cookie') {
      res.setHeader('set-cookie', 'e2e=ok; Path=/');
      res.setHeader('content-type', 'text/plain');
      res.end('ok');
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

export function assert(cond, msg, cleanup) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    if (cleanup) cleanup();
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}
