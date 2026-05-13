import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ensureBrowser, ensurePage, applyPageDefaults } from '../../src/state';
import { setPuppeteer, resetPuppeteer } from '../../src/puppeteer';
import { createMockBrowser, createMockPage } from './mocks/puppeteer.mock';
import { createMockLog, createMockState } from './mocks/state.mock';
import { assertCalledTimes, assertCalled, assertNotCalled } from './_helpers';
import { mock } from 'node:test';

describe('ensureBrowser', () => {
  let fakePuppeteer: any;

  beforeEach(() => {
    const mockBrowser = createMockBrowser();
    fakePuppeteer = {
      launch: mock.fn(async () => mockBrowser),
      connect: mock.fn(),
    };
    setPuppeteer(fakePuppeteer);
  });

  afterEach(() => resetPuppeteer());

  it('returns existing browser without relaunching', async () => {
    const existing = createMockBrowser();
    const state = createMockState({ browser: existing });
    const result = await ensureBrowser(state, createMockLog());
    assert.equal(result, existing);
    assertNotCalled(fakePuppeteer.launch);
  });

  it('launches when no browser yet', async () => {
    const state = createMockState();
    await ensureBrowser(state, createMockLog());
    assertCalledTimes(fakePuppeteer.launch, 1);
    assert.ok(state.browser);
  });

  it('serialises concurrent launches into one Chromium', async () => {
    const state = createMockState();
    const log = createMockLog();
    const [a, b, c] = await Promise.all([
      ensureBrowser(state, log),
      ensureBrowser(state, log),
      ensureBrowser(state, log),
    ]);
    assertCalledTimes(fakePuppeteer.launch, 1);
    assert.equal(a, b);
    assert.equal(b, c);
    assert.equal(state.browserLaunching, null, 'in-flight slot cleared after settle');
  });

  it('clears the in-flight slot even when launch rejects', async () => {
    const state = createMockState();
    fakePuppeteer.launch.mock.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    await assert.rejects(ensureBrowser(state, createMockLog()), { message: 'boom' });
    assert.equal(state.browserLaunching, null);
    assert.equal(state.browser, null);
  });
});

describe('ensurePage', () => {
  it('returns existing page without creating a new one', async () => {
    const existing = createMockPage();
    const mockBrowser = createMockBrowser();
    const state = createMockState({ browser: mockBrowser, pages: new Map([['p1', existing]]) });

    const result = await ensurePage(state, 'p1', createMockLog());

    assert.equal(result, existing);
    assertNotCalled(mockBrowser.newPage as any);
  });

  it('creates and stores a new page when missing', async () => {
    const fresh = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: fresh });
    const state = createMockState({ browser: mockBrowser });

    const result = await ensurePage(state, 'p1', createMockLog());

    assert.equal(result, fresh);
    assert.equal(state.pages.get('p1'), fresh);
    assertCalledTimes(mockBrowser.newPage as any, 1);
  });

  it('serialises concurrent ensurePage calls for the same pageId', async () => {
    const fresh = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: fresh });
    const state = createMockState({ browser: mockBrowser });
    const log = createMockLog();

    const [a, b, c] = await Promise.all([
      ensurePage(state, 'shared', log),
      ensurePage(state, 'shared', log),
      ensurePage(state, 'shared', log),
    ]);

    assertCalledTimes(mockBrowser.newPage as any, 1);
    assert.equal(a, b);
    assert.equal(b, c);
    assert.ok(!state.pageCreations.has('shared'), 'in-flight slot cleared');
  });

  it('parallel calls for different pageIds each get their own page', async () => {
    const mockBrowser = createMockBrowser();
    const state = createMockState({ browser: mockBrowser });
    const log = createMockLog();

    await Promise.all([
      ensurePage(state, 'a', log),
      ensurePage(state, 'b', log),
    ]);

    assertCalledTimes(mockBrowser.newPage as any, 2);
    assert.ok(state.pages.has('a'));
    assert.ok(state.pages.has('b'));
  });

  it('auto-launches the browser if missing', async () => {
    const fresh = createMockPage();
    const fakeBrowser = createMockBrowser({ newPageMock: fresh });
    const fakePuppeteer = {
      launch: mock.fn(async () => fakeBrowser),
      connect: mock.fn(),
    };
    setPuppeteer(fakePuppeteer as any);
    try {
      const state = createMockState();
      await ensurePage(state, 'p1', createMockLog());
      assertCalledTimes(fakePuppeteer.launch, 1);
      assert.equal(state.browser, fakeBrowser);
    } finally {
      resetPuppeteer();
    }
  });
});

describe('applyPageDefaults', () => {
  it('applies viewport when set', async () => {
    const page = createMockPage();
    const state = createMockState();
    state.currentViewport = { width: 1024, height: 600 };
    await applyPageDefaults(page, state);
    assertCalled(page.setViewport as any);
  });

  it('applies custom userAgent when set, in preference to stealth UA', async () => {
    const page = createMockPage();
    const state = createMockState();
    state.currentUserAgent = 'my-ua';
    state.currentStealth = true;
    await applyPageDefaults(page, state);
    const calls = (page.setUserAgent as any).mock.calls;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arguments[0], 'my-ua');
  });

  it('applies stealth UA when stealth=true and no custom UA', async () => {
    const page = createMockPage();
    const state = createMockState();
    state.currentStealth = true;
    await applyPageDefaults(page, state);
    const ua = (page.setUserAgent as any).mock.calls[0].arguments[0];
    assert.ok(/Chrome\/120/.test(ua), `stealth UA looks like Chrome 120 (got ${ua})`);
  });

  it('registers the stealth shim on new documents when stealth=true', async () => {
    const page = createMockPage();
    const state = createMockState();
    state.currentStealth = true;
    await applyPageDefaults(page, state);
    assertCalled(page.evaluateOnNewDocument as any);
    const fn = (page.evaluateOnNewDocument as any).mock.calls[0].arguments[0];
    assert.equal(typeof fn, 'function', 'stealth shim is passed as a real function, not a string (regression check)');
  });

  it('does nothing when no defaults are set', async () => {
    const page = createMockPage();
    const state = createMockState();
    await applyPageDefaults(page, state);
    assertNotCalled(page.setViewport as any);
    assertNotCalled(page.setUserAgent as any);
    assertNotCalled(page.evaluateOnNewDocument as any);
  });
});
