#!/usr/bin/env node
// Happy-path E2E. Spawns the built MCP server, drives a real Chromium, and
// asserts every handler works end-to-end against a real local HTTP origin.
//
// Run via `pnpm test:e2e` from the project root.

import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decode as toonDecode } from '@toon-format/toon';
import { spawnServer, startTestHttpServer, assert } from './_harness.mjs';

const http = await startTestHttpServer();
const server = spawnServer();
const cleanup = () => { server.kill(); http.close(); };

try {
  // ---- protocol baseline ----
  const init = await server.initialize();
  assert(init.result?.serverInfo?.name === 'puppeteer-mcp-claude', 'initialize returns serverInfo', cleanup);

  const list = await server.call('tools/list', {});
  assert(list.result?.tools?.length === 15, `tools/list returns 15 tools (got ${list.result?.tools?.length})`, cleanup);

  // ---- lazy launch + navigate ----
  let r = await server.callTool('puppeteer_navigate', { url: `${http.baseUrl}/index.html` });
  assert(!r.error && r.result.structuredContent.action === 'navigated', 'lazy auto-launch + navigate (no explicit launch, no pageId)', cleanup);

  const decoded = toonDecode(r.result.content[0].text);
  assert(
    JSON.stringify(decoded) === JSON.stringify(r.result.structuredContent),
    'TOON wire text round-trips to structuredContent',
    cleanup
  );

  // ---- get_text ----
  r = await server.callTool('puppeteer_get_text', { selector: '#title' });
  assert(r.result.structuredContent.text === 'Welcome', 'get_text reads DOM textContent', cleanup);

  // ---- type into input ----
  r = await server.callTool('puppeteer_type', { selector: '#name', text: 'world' });
  assert(r.result.structuredContent.action === 'typed', 'type into input', cleanup);

  // ---- click button ----
  r = await server.callTool('puppeteer_click', { selector: '#submit' });
  assert(r.result.structuredContent.action === 'clicked', 'click button', cleanup);

  // ---- evaluate confirms click+type effect ----
  r = await server.callTool('puppeteer_evaluate', { script: 'document.getElementById("result").textContent' });
  assert(r.result.structuredContent.result === 'clicked: world', `evaluate confirms click+type effect (got ${JSON.stringify(r.result.structuredContent.result)})`, cleanup);

  // ---- wait_for_selector (element appears after 200ms) ----
  r = await server.callTool('puppeteer_wait_for_selector', { selector: '#late', timeout: 5000 });
  assert(r.result.structuredContent.action === 'selector_appeared', 'wait_for_selector resolves for delayed element', cleanup);

  // ---- set_cookies / get_cookies / delete_cookies ----
  r = await server.callTool('puppeteer_set_cookies', {
    cookies: [{ name: 'flavour', value: 'chocolate', domain: '127.0.0.1', path: '/' }],
  });
  assert(r.result.structuredContent.count === 1, 'set_cookies count=1', cleanup);

  r = await server.callTool('puppeteer_get_cookies', {});
  const flavour = r.result.structuredContent.cookies.find((c) => c.name === 'flavour');
  assert(flavour?.value === 'chocolate', 'get_cookies returns the cookie we set', cleanup);

  r = await server.callTool('puppeteer_delete_cookies', { cookies: [{ name: 'flavour', domain: '127.0.0.1', path: '/' }] });
  assert(r.result.structuredContent.count === 1, 'delete_cookies count=1', cleanup);

  r = await server.callTool('puppeteer_get_cookies', {});
  const stillThere = r.result.structuredContent.cookies.find((c) => c.name === 'flavour');
  assert(!stillThere, 'get_cookies confirms deletion', cleanup);

  // ---- screenshot returns valid PNG + structuredContent ----
  const shotPath = join(tmpdir(), `mcp-e2e-${Date.now()}.png`);
  r = await server.callTool('puppeteer_screenshot', { path: shotPath, fullPage: false });
  assert(!r.error, 'screenshot succeeded', cleanup);
  const sc = r.result.structuredContent;
  assert(sc.bytes > 0 && sc.path === shotPath, 'screenshot structuredContent has bytes and path', cleanup);

  const img = r.result.content[1];
  assert(img?.type === 'image' && img.mimeType === 'image/png', 'screenshot includes image content block', cleanup);
  const inline = Buffer.from(img.data, 'base64');
  assert(inline[0] === 0x89 && inline[1] === 0x50 && inline[2] === 0x4e && inline[3] === 0x47, 'inline base64 is a valid PNG', cleanup);

  const onDisk = readFileSync(shotPath);
  assert(onDisk[0] === 0x89 && onDisk[1] === 0x50, 'saved file is a valid PNG', cleanup);
  unlinkSync(shotPath);

  // ---- multi-page: new_page + close_page ----
  r = await server.callTool('puppeteer_new_page', { pageId: 'second' });
  assert(r.result.structuredContent.pageId === 'second', 'new_page with explicit pageId', cleanup);

  r = await server.callTool('puppeteer_navigate', { pageId: 'second', url: `${http.baseUrl}/index.html` });
  assert(r.result.structuredContent.pageId === 'second' && r.result.structuredContent.action === 'navigated', 'navigate on second tab', cleanup);

  r = await server.callTool('puppeteer_close_page', { pageId: 'second' });
  assert(r.result.structuredContent.action === 'page_closed' && r.result.structuredContent.pageId === 'second', 'close_page closes the second tab', cleanup);

  // ---- request interception: block images ----
  r = await server.callTool('puppeteer_new_page', { pageId: 'intercept' });
  assert(r.result.structuredContent.action === 'page_created', 'new_page for interception test', cleanup);

  r = await server.callTool('puppeteer_set_request_interception', {
    pageId: 'intercept',
    enable: true,
    blockResources: ['image'],
  });
  assert(r.result.structuredContent.enabled === true && r.result.structuredContent.blockedResources?.includes('image'), 'set_request_interception enabled + images blocked', cleanup);

  r = await server.callTool('puppeteer_navigate', { pageId: 'intercept', url: `${http.baseUrl}/index.html` });
  assert(r.result.structuredContent.action === 'navigated', 'navigate with interception active', cleanup);

  // Verify the image actually got blocked by checking naturalWidth on the <img>
  r = await server.callTool('puppeteer_evaluate', {
    pageId: 'intercept',
    script: 'document.getElementById("img").naturalWidth',
  });
  assert(r.result.structuredContent.result === 0, `image was blocked (naturalWidth=${r.result.structuredContent.result}, expected 0)`, cleanup);

  // ---- close_browser ----
  r = await server.callTool('puppeteer_close_browser', {});
  assert(r.result.structuredContent.wasOpen === true, 'close_browser reports wasOpen=true', cleanup);

  console.log('\n=== HAPPY-PATH E2E PASSED ===');
  cleanup();
  process.exit(0);
} catch (err) {
  console.error('E2E FAIL:', err);
  cleanup();
  process.exit(1);
}
