#!/usr/bin/env node
// Discovers and runs every tests/e2e/*.e2e.mjs file in sequence. Adding a new
// E2E means dropping a new `<name>.e2e.mjs` in this folder — no script edits.
//
// Each file is spawned as its own Node process so handlers, exit codes, and
// stdio buffers don't leak between tests.

import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const here = dirname(__filename);

const files = readdirSync(here)
  .filter((f) => f.endsWith('.e2e.mjs'))
  .filter((f) => !f.startsWith('_'))
  .sort();

if (files.length === 0) {
  console.error('No *.e2e.mjs files found in tests/e2e/');
  process.exit(1);
}

console.log(`Found ${files.length} E2E file(s):\n  ${files.join('\n  ')}\n`);

const start = Date.now();
let failed = 0;

for (const f of files) {
  const banner = `═══════ ${f} ═══════`;
  console.log(`\n${banner}`);
  const status = await new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, f)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
  if (status !== 0) {
    failed += 1;
    console.error(`✗ ${f} exited with code ${status}`);
  }
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`\n${'═'.repeat(50)}`);
if (failed === 0) {
  console.log(`✓ All ${files.length} E2E files passed in ${elapsed}s`);
  process.exit(0);
} else {
  console.error(`✗ ${failed}/${files.length} E2E files failed (${elapsed}s)`);
  process.exit(1);
}
