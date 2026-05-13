import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleNewPage, handleClosePage } from '../../../src/handlers/page';
import { createMockPage, createMockBrowser } from '../mocks/puppeteer.mock';
import { createMockState, createMockStateWithBrowser } from '../mocks/state.mock';
import { assertCalled, assertCalledWith, assertNotCalled, rejectWith } from '../_helpers';

describe('handleNewPage', () => {
  it('should create a new page with the given pageId', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: mockPage });
    const state = createMockState({ browser: mockBrowser });

    const result = await handleNewPage({ pageId: 'test-page' }, state);

    assertCalled(mockBrowser.newPage as any);
    assert.equal(state.pages.get('test-page'), mockPage);
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'page_created');
    assert.equal(sc.pageId, 'test-page');
    assert.equal(sc.ok, true);
  });

  it('should apply stored viewport to new page', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: mockPage });
    const state = createMockState({ browser: mockBrowser });
    state.currentViewport = { width: 1920, height: 1080 };

    await handleNewPage({ pageId: 'test-page' }, state);

    assertCalledWith(mockPage.setViewport as any, { width: 1920, height: 1080 });
  });

  it('should not set viewport if none is stored', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: mockPage });
    const state = createMockState({ browser: mockBrowser });
    state.currentViewport = null;

    await handleNewPage({ pageId: 'test-page' }, state);

    assertNotCalled(mockPage.setViewport as any);
  });

  it('should throw if browser is not launched', async () => {
    const state = createMockState({ browser: null });

    await assert.rejects(
      handleNewPage({ pageId: 'test-page' }, state),
      { message: 'Browser not launched. Call puppeteer_launch first.' }
    );
  });

  it('rejects when pageId already exists (prevents silent tab leak)', async () => {
    const existingPage = createMockPage();
    const newPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: newPage });
    const state = createMockState({
      browser: mockBrowser,
      pages: new Map([['test-page', existingPage]]),
    });

    await assert.rejects(handleNewPage({ pageId: 'test-page' }, state), {
      message: /already exists/,
    });
    // existing page reference is untouched
    assert.equal(state.pages.get('test-page'), existingPage);
  });

  it('should handle browser.newPage failure', async () => {
    const mockBrowser = createMockBrowser({
      newPageError: new Error('Failed to create page'),
    });
    const state = createMockState({ browser: mockBrowser });

    await assert.rejects(
      handleNewPage({ pageId: 'test-page' }, state),
      { message: 'Failed to create page' }
    );
  });
});

describe('handleClosePage', () => {
  it('should close the page and remove from state', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['test-page', mockPage]]);

    const result = await handleClosePage({ pageId: 'test-page' }, state);

    assertCalled(mockPage.close as any);
    assert.equal(state.pages.has('test-page'), false);
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'page_closed');
    assert.equal(sc.pageId, 'test-page');
    assert.equal(sc.ok, true);
  });

  it('should throw if pageId is not found', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleClosePage({ pageId: 'unknown' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should handle page.close failure', async () => {
    const mockPage = createMockPage();
    rejectWith(mockPage.close as any, new Error('Close failed'));
    const state = createMockStateWithBrowser([['test-page', mockPage]]);

    await assert.rejects(
      handleClosePage({ pageId: 'test-page' }, state),
      { message: 'Close failed' }
    );
  });
});

describe('page handler edge cases', () => {
  describe('handleNewPage edge cases', () => {
    it('should handle pageId with special characters', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser({ newPageMock: mockPage });
      const state = createMockState({ browser: mockBrowser });

      const result = await handleNewPage({ pageId: 'page-with_special.chars:123' }, state);

      assert.equal(state.pages.get('page-with_special.chars:123'), mockPage);
      const sc = result.structuredContent as any;
      assert.equal(sc.action, 'page_created');
      assert.equal(sc.pageId, 'page-with_special.chars:123');
    });

    it('should handle pageId with unicode', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser({ newPageMock: mockPage });
      const state = createMockState({ browser: mockBrowser });

      await handleNewPage({ pageId: 'ページ-日本語' }, state);

      assert.equal(state.pages.get('ページ-日本語'), mockPage);
    });

    it('should handle very long pageId', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser({ newPageMock: mockPage });
      const state = createMockState({ browser: mockBrowser });
      const longId = 'page-' + 'a'.repeat(500);

      await handleNewPage({ pageId: longId }, state);

      assert.equal(state.pages.get(longId), mockPage);
    });

    it('should handle creating many pages', async () => {
      const mockBrowser = createMockBrowser();
      const state = createMockState({ browser: mockBrowser });

      for (let i = 0; i < 20; i++) {
        await handleNewPage({ pageId: `page${i}` }, state);
      }

      assert.equal(state.pages.size, 20);
    });

    it('should handle empty string pageId', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser({ newPageMock: mockPage });
      const state = createMockState({ browser: mockBrowser });

      await handleNewPage({ pageId: '' }, state);

      assert.equal(state.pages.get(''), mockPage);
    });
  });

  describe('handleClosePage edge cases', () => {
    it('should handle closing last page', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['last-page', mockPage]]);

      await handleClosePage({ pageId: 'last-page' }, state);

      assert.equal(state.pages.size, 0);
    });

    it('should handle closing one of many pages', async () => {
      const pages: Array<[string, any]> = [
        ['page1', createMockPage()],
        ['page2', createMockPage()],
        ['page3', createMockPage()],
      ];
      const state = createMockStateWithBrowser(pages);

      await handleClosePage({ pageId: 'page2' }, state);

      assert.equal(state.pages.size, 2);
      assert.equal(state.pages.has('page1'), true);
      assert.equal(state.pages.has('page2'), false);
      assert.equal(state.pages.has('page3'), true);
    });

    it('should handle pageId with spaces', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page with spaces', mockPage]]);

      const result = await handleClosePage({ pageId: 'page with spaces' }, state);

      const sc = result.structuredContent as any;
      assert.equal(sc.action, 'page_closed');
      assert.equal(sc.pageId, 'page with spaces');
      assert.equal(state.pages.has('page with spaces'), false);
    });
  });
});
