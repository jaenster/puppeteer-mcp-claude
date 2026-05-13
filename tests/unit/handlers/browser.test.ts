import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleCloseBrowser } from '../../../src/handlers/browser';
import { createMockBrowser, createMockPage } from '../mocks/puppeteer.mock';
import { createMockState } from '../mocks/state.mock';
import { assertCalled, assertCalledTimes, rejectWith } from '../_helpers';

describe('handleCloseBrowser', () => {
  it('closes browser and clears pages', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser();
    const state = createMockState({
      browser: mockBrowser,
      pages: new Map([['page1', mockPage]]),
    });

    const result = await handleCloseBrowser({}, state);

    assertCalled(mockBrowser.close as any);
    assert.equal(state.browser, null);
    assert.equal(state.pages.size, 0);
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'browser_closed');
    assert.equal(sc.ok, true);
    assert.equal(sc.wasOpen, true);
  });

  it('handles no browser launched', async () => {
    const state = createMockState({ browser: null });

    const result = await handleCloseBrowser({}, state);

    assert.equal(state.browser, null);
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'browser_closed');
    assert.equal(sc.ok, true);
    assert.equal(sc.wasOpen, false);
  });

  it('clears multiple pages', async () => {
    const mockBrowser = createMockBrowser();
    const state = createMockState({
      browser: mockBrowser,
      pages: new Map([
        ['page1', createMockPage()],
        ['page2', createMockPage()],
        ['page3', createMockPage()],
      ]),
    });

    await handleCloseBrowser({}, state);

    assert.equal(state.pages.size, 0);
  });

  it('propagates browser.close errors', async () => {
    const mockBrowser = createMockBrowser();
    rejectWith(mockBrowser.close as any, new Error('Close failed'));
    const state = createMockState({ browser: mockBrowser });

    await assert.rejects(handleCloseBrowser({}, state), { message: 'Close failed' });
  });

  it('is idempotent when called multiple times', async () => {
    const mockBrowser = createMockBrowser();
    const state = createMockState({ browser: mockBrowser });

    await handleCloseBrowser({}, state);
    const result = await handleCloseBrowser({}, state);

    assertCalledTimes(mockBrowser.close as any, 1);
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'browser_closed');
    assert.equal(sc.ok, true);
    assert.equal(sc.wasOpen, false);
  });
});
