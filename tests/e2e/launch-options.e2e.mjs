#!/usr/bin/env node
// Real-browser tests for puppeteer_launch's configurable options.
//
// Covers: userAgent, viewport, stealth, custom Chrome --args, and
// browserWSEndpoint (connecting to an externally-managed Chrome).
//
// Run via `pnpm test:e2e` from the project root.

import puppeteer from 'puppeteer';
import { spawnServer, assert } from './_harness.mjs';

// ---- userAgent ----
async function testUserAgent() {
  const server = spawnServer();
  const cleanup = () => server.kill();
  try {
    await server.initialize();
    const customUA = 'puppeteer-mcp-claude-e2e/1.0';

    let r = await server.callTool('puppeteer_launch', { userAgent: customUA });
    assert(!r.error, 'launch with custom userAgent', cleanup);

    r = await server.callTool('puppeteer_navigate', { url: 'data:text/html,<p>x</p>' });
    assert(!r.error, 'navigate after custom-UA launch', cleanup);

    r = await server.callTool('puppeteer_evaluate', { script: 'navigator.userAgent' });
    assert(
      r.result.structuredContent.result === customUA,
      `navigator.userAgent === custom value (got ${r.result.structuredContent.result})`,
      cleanup
    );

    await server.callTool('puppeteer_close_browser', {});
  } finally {
    cleanup();
  }
}

// ---- viewport ----
async function testViewport() {
  const server = spawnServer();
  const cleanup = () => server.kill();
  try {
    await server.initialize();
    const viewport = { width: 1024, height: 600 };

    let r = await server.callTool('puppeteer_launch', { viewport });
    assert(!r.error, 'launch with custom viewport', cleanup);

    r = await server.callTool('puppeteer_navigate', { url: 'data:text/html,<p>x</p>' });
    assert(!r.error, 'navigate after viewport launch', cleanup);

    r = await server.callTool('puppeteer_evaluate', {
      script: '({ w: window.innerWidth, h: window.innerHeight })',
    });
    const got = r.result.structuredContent.result;
    assert(
      got.w === viewport.width && got.h === viewport.height,
      `viewport applied (got ${got.w}x${got.h}, want ${viewport.width}x${viewport.height})`,
      cleanup
    );

    await server.callTool('puppeteer_close_browser', {});
  } finally {
    cleanup();
  }
}

// ---- stealth ----
async function testStealth() {
  const server = spawnServer();
  const cleanup = () => server.kill();
  try {
    await server.initialize();

    let r = await server.callTool('puppeteer_launch', { stealth: true });
    assert(!r.error, 'launch with stealth=true', cleanup);

    r = await server.callTool('puppeteer_navigate', { url: 'data:text/html,<p>x</p>' });
    assert(!r.error, 'navigate after stealth launch', cleanup);

    // navigator.webdriver should be undefined (stealth tweak)
    r = await server.callTool('puppeteer_evaluate', { script: 'navigator.webdriver' });
    assert(
      r.result.structuredContent.result === undefined ||
        r.result.structuredContent.result === null,
      `navigator.webdriver scrubbed (got ${JSON.stringify(r.result.structuredContent.result)})`,
      cleanup
    );

    // navigator.languages set to a multi-entry list by the stealth shim
    r = await server.callTool('puppeteer_evaluate', { script: 'navigator.languages.length' });
    assert(
      r.result.structuredContent.result >= 1,
      `navigator.languages populated (length=${r.result.structuredContent.result})`,
      cleanup
    );

    // window.chrome exists
    r = await server.callTool('puppeteer_evaluate', { script: 'typeof window.chrome' });
    assert(
      r.result.structuredContent.result === 'object',
      `window.chrome injected (typeof=${r.result.structuredContent.result})`,
      cleanup
    );

    // UA looks like a regular Chrome (no "HeadlessChrome")
    r = await server.callTool('puppeteer_evaluate', { script: 'navigator.userAgent' });
    assert(
      !String(r.result.structuredContent.result).includes('HeadlessChrome'),
      `UA does not advertise HeadlessChrome (got ${r.result.structuredContent.result})`,
      cleanup
    );

    await server.callTool('puppeteer_close_browser', {});
  } finally {
    cleanup();
  }
}

// ---- custom Chrome --args ----
async function testCustomArgs() {
  const server = spawnServer();
  const cleanup = () => server.kill();
  try {
    await server.initialize();
    // --window-size affects outerWidth/outerHeight in headless mode.
    let r = await server.callTool('puppeteer_launch', {
      args: ['--window-size=900,650'],
      // Disable the default viewport so window.outerWidth reflects --window-size.
    });
    assert(!r.error, 'launch with --window-size=900,650', cleanup);

    r = await server.callTool('puppeteer_navigate', { url: 'data:text/html,<p>x</p>' });
    assert(!r.error, 'navigate after custom-args launch', cleanup);

    r = await server.callTool('puppeteer_evaluate', {
      script: '({ ow: window.outerWidth, oh: window.outerHeight })',
    });
    const got = r.result.structuredContent.result;
    // Headless Chrome honours --window-size at the OS-window level; outerWidth
    // should be close to (typically equal to) the requested width. Allow a
    // small tolerance for chrome chrome (toolbars etc).
    assert(
      Math.abs(got.ow - 900) <= 20 && Math.abs(got.oh - 650) <= 60,
      `--window-size honoured (outer ${got.ow}x${got.oh}, want ~900x650)`,
      cleanup
    );

    await server.callTool('puppeteer_close_browser', {});
  } finally {
    cleanup();
  }
}

// ---- browserWSEndpoint ----
async function testWSEndpoint() {
  // Launch an external Chrome instance in this test process so we have a
  // known wsEndpoint to point our MCP server at.
  const externalBrowser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const wsEndpoint = externalBrowser.wsEndpoint();

  const server = spawnServer();
  const cleanup = () => {
    server.kill();
    externalBrowser.close().catch(() => {});
  };

  try {
    await server.initialize();

    let r = await server.callTool('puppeteer_launch', { browserWSEndpoint: wsEndpoint });
    assert(!r.error, 'launch with browserWSEndpoint', cleanup);
    assert(
      r.result.structuredContent.action === 'browser_connected',
      `action is browser_connected (got ${r.result.structuredContent.action})`,
      cleanup
    );

    // Confirm the connected browser is the same one — set a sentinel via the
    // MCP server, then read it back from the external puppeteer handle.
    r = await server.callTool('puppeteer_new_page', { pageId: 'shared' });
    assert(!r.error, 'create page on connected browser', cleanup);

    r = await server.callTool('puppeteer_navigate', {
      pageId: 'shared',
      url: 'data:text/html,<title>shared-tab</title><p>hi</p>',
    });
    assert(!r.error, 'navigate connected page', cleanup);

    // Find the page via the external puppeteer handle
    const pages = await externalBrowser.pages();
    const titles = await Promise.all(pages.map((p) => p.title().catch(() => '')));
    assert(
      titles.some((t) => t === 'shared-tab'),
      `external puppeteer sees the connected page (titles: ${JSON.stringify(titles)})`,
      cleanup
    );

    // close_browser via MCP should disconnect, but the external Chrome
    // remains running — we own its lifetime.
    await server.callTool('puppeteer_close_browser', {});
    // Verify external chrome is still alive
    const stillAlive = (await externalBrowser.pages()).length > 0;
    assert(stillAlive, 'external Chrome still alive after MCP disconnect', cleanup);
  } finally {
    cleanup();
  }
}

try {
  console.log('--- userAgent ---');
  await testUserAgent();
  console.log('--- viewport ---');
  await testViewport();
  console.log('--- stealth ---');
  await testStealth();
  console.log('--- custom Chrome args ---');
  await testCustomArgs();
  console.log('--- browserWSEndpoint ---');
  await testWSEndpoint();
  console.log('\n=== LAUNCH-OPTIONS E2E PASSED ===');
  process.exit(0);
} catch (err) {
  console.error('E2E FAIL:', err);
  process.exit(1);
}
