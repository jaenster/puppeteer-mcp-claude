#!/usr/bin/env node
// Discovers and runs every tests/e2e/*.e2e.mjs file in sequence. Adding a new
// E2E means dropping a new `<name>.e2e.mjs` in this folder — no script edits.
//
// Each file is spawned as its own Node process so handlers, exit codes, and
// stdio buffers don't leak between tests.
//
// Modes:
//   - If MCP_SERVER_CMD or MCP_SERVER_ENTRY is set, run once with that env.
//     (CI uses this to drive the globally-installed package.)
//   - Otherwise, run TWICE: once against `dist/index.js` directly, once via
//     `node bin/cli.mjs serve` (the bin shim path users actually hit).
//     The shim path catches regressions in signal forwarding and the in-process
//     import flow — a problem that bit v0.2.0.

import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const here = dirname(__filename);
const repoRoot = join(here, '..', '..');

const files = readdirSync(here)
  .filter((f) => f.endsWith('.e2e.mjs'))
  .filter((f) => !f.startsWith('_'))
  .sort();

if (files.length === 0) {
  console.error('No *.e2e.mjs files found in tests/e2e/');
  process.exit(1);
}

const envSetByCaller = process.env.MCP_SERVER_CMD || process.env.MCP_SERVER_ENTRY;

const passes = envSetByCaller
  ? [{ label: 'caller-provided', env: {} }]
  : [
      { label: 'direct (node dist/index.js)', env: {} },
      {
        label: 'bin shim (node bin/cli.mjs serve)',
        env: { MCP_SERVER_CMD: `node ${join(repoRoot, 'bin', 'cli.mjs')} serve` },
      },
    ];

console.log(`Found ${files.length} E2E file(s):\n  ${files.join('\n  ')}\n`);
console.log(`Running ${passes.length} pass(es):\n  ${passes.map((p) => p.label).join('\n  ')}\n`);

const start = Date.now();
let failed = 0;

for (const pass of passes) {
  console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
  console.log(`║ pass: ${pass.label.padEnd(60)} ║`);
  console.log(`╚════════════════════════════════════════════════════════════════════╝`);

  for (const f of files) {
    const banner = `═══════ ${f} (${pass.label}) ═══════`;
    console.log(`\n${banner}`);
    const status = await new Promise((resolve) => {
      const child = spawn(process.execPath, [join(here, f)], {
        stdio: 'inherit',
        env: { ...process.env, ...pass.env },
      });
      child.on('exit', (code) => resolve(code ?? 1));
      child.on('error', () => resolve(1));
    });
    if (status !== 0) {
      failed += 1;
      console.error(`✗ ${f} [${pass.label}] exited with code ${status}`);
    }
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const total = files.length * passes.length;

console.log(`\n${'═'.repeat(50)}`);
if (failed === 0) {
  console.log(`✓ All ${total} E2E run(s) passed in ${elapsed}s`);
  process.exit(0);
} else {
  console.error(`✗ ${failed}/${total} E2E runs failed (${elapsed}s)`);
  process.exit(1);
}
