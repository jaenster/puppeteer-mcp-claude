#!/usr/bin/env node
// Error-path E2E. Confirms that bad tool calls produce a defined error
// response (`isError: true` content) rather than crashing the server or
// hanging the stdio pipe.

import { spawnServer, assert } from './_harness.mjs';

const server = spawnServer();
const cleanup = () => server.kill();

function isErrorResult(r) {
  // McpServer reports tool failures via `isError: true` on the result with
  // the message in a text content block. We also accept JSON-RPC errors.
  if (r.error) return true;
  if (r.result?.isError === true) return true;
  return false;
}

function errMessage(r) {
  if (r.error) return r.error.message;
  if (r.result?.isError) {
    return r.result.content?.map((c) => c.text).join('\n') ?? '(no text)';
  }
  return '(no error)';
}

try {
  await server.initialize();
  assert(true, 'initialize', cleanup);

  // 1. Navigate to closed port — net::ERR_CONNECTION_REFUSED
  let r = await server.callTool('puppeteer_navigate', { url: 'http://127.0.0.1:1/never-listens' });
  assert(isErrorResult(r), `navigate to closed port returns an error response (${errMessage(r).slice(0, 80)})`, cleanup);

  // After a failed navigation the auto-launched browser stays alive. Move on
  // by navigating somewhere valid for the remaining tests.
  r = await server.callTool('puppeteer_navigate', { url: 'data:text/html,<html><body><h1>x</h1></body></html>' });
  assert(!isErrorResult(r), 'recovery navigate to data: URL succeeds', cleanup);

  // 2. get_text on missing selector — handler throws "Element X not found"
  r = await server.callTool('puppeteer_get_text', { selector: '#does-not-exist' });
  assert(isErrorResult(r), `get_text on missing selector returns an error (${errMessage(r).slice(0, 80)})`, cleanup);

  // 3. click on missing selector — page.click rejects
  r = await server.callTool('puppeteer_click', { selector: '#does-not-exist' });
  assert(isErrorResult(r), `click on missing selector returns an error (${errMessage(r).slice(0, 80)})`, cleanup);

  // 4. evaluate throws — error must propagate
  r = await server.callTool('puppeteer_evaluate', { script: '(() => { throw new Error("boom"); })()' });
  assert(isErrorResult(r), `evaluate that throws returns an error (${errMessage(r).slice(0, 80)})`, cleanup);

  // 5. wait_for_selector timeout
  r = await server.callTool('puppeteer_wait_for_selector', { selector: '#never', timeout: 250 });
  assert(isErrorResult(r), `wait_for_selector timeout returns an error (${errMessage(r).slice(0, 80)})`, cleanup);

  // 6. close_page on a pageId that doesn't exist
  r = await server.callTool('puppeteer_close_page', { pageId: 'never-opened' });
  assert(isErrorResult(r), `close_page on unknown pageId returns an error (${errMessage(r).slice(0, 80)})`, cleanup);

  // 7. Schema-level rejection: missing required field — zod rejects, MCP returns error
  r = await server.callTool('puppeteer_navigate', {}); // url is required
  assert(isErrorResult(r), `tool call with missing required field is rejected (${errMessage(r).slice(0, 80)})`, cleanup);

  // 8. The server is still responsive after all these errors
  r = await server.callTool('puppeteer_get_text', { selector: 'h1' });
  assert(!isErrorResult(r) && r.result.structuredContent.text === 'x', 'server is still healthy after error sequence', cleanup);

  await server.callTool('puppeteer_close_browser', {});

  console.log('\n=== ERROR-PATH E2E PASSED ===');
  cleanup();
  process.exit(0);
} catch (err) {
  console.error('E2E FAIL:', err);
  cleanup();
  process.exit(1);
}
