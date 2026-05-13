#!/usr/bin/env node
// Verifies the SIGINT handler in src/index.ts actually closes the underlying
// Chromium when the parent process is asked to shut down — no orphaned
// browser processes left behind.
//
// POSIX-only (uses `ps` to walk the process tree). Skipped on Windows.

import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { spawnServer, assert } from './_harness.mjs';

if (process.platform === 'win32') {
  console.log('cleanup.e2e: skipped on Windows (no ps).');
  process.exit(0);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getDescendants(rootPid) {
  // `ps -A -o pid=,ppid=` is portable across linux + macOS.
  const out = execSync('ps -A -o pid=,ppid=').toString();
  const childrenOf = new Map();
  for (const raw of out.split('\n')) {
    const m = raw.trim().match(/^(\d+)\s+(\d+)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const ppid = Number(m[2]);
    if (!childrenOf.has(ppid)) childrenOf.set(ppid, []);
    childrenOf.get(ppid).push(pid);
  }
  const visited = new Set();
  const stack = [rootPid];
  while (stack.length) {
    const p = stack.pop();
    for (const child of childrenOf.get(p) ?? []) {
      if (!visited.has(child)) {
        visited.add(child);
        stack.push(child);
      }
    }
  }
  return [...visited];
}

const server = spawnServer();
const cleanup = () => server.kill('SIGKILL');

try {
  await server.initialize();
  assert(true, 'initialize', cleanup);

  // Trigger lazy auto-launch — this fires up Chromium under the server's PID.
  const r = await server.callTool('puppeteer_navigate', {
    url: 'data:text/html,<p>x</p>',
  });
  assert(!r.error, 'navigate triggers lazy browser launch', cleanup);

  // Give Chromium a beat to fully start.
  await sleep(200);

  const childrenBefore = getDescendants(server.child.pid);
  assert(
    childrenBefore.length > 0,
    `server has descendant processes (${childrenBefore.length})`,
    cleanup
  );
  console.log(`  descendant PIDs: ${childrenBefore.join(', ')}`);

  // ---- SIGINT the server, wait for exit ----
  const exited = new Promise((resolve) => server.child.once('exit', resolve));
  server.child.kill('SIGINT');

  const code = await Promise.race([
    exited,
    sleep(10_000).then(() => 'TIMEOUT'),
  ]);
  assert(code !== 'TIMEOUT', 'server exited within 10s of SIGINT', cleanup);

  // Give the OS a moment to reap the chromium descendants.
  await sleep(500);

  const stillAlive = childrenBefore.filter(isAlive);
  assert(
    stillAlive.length === 0,
    `all browser descendants cleaned up (still alive: ${JSON.stringify(stillAlive)})`,
    cleanup
  );

  console.log('\n=== SIGINT CLEANUP E2E PASSED ===');
  process.exit(0);
} catch (err) {
  console.error('E2E FAIL:', err);
  cleanup();
  process.exit(1);
}
