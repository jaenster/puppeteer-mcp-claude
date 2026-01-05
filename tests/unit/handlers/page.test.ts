import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleNewPage, handleClosePage } from '../../../src/handlers/page';
import { createMockPage, createMockBrowser } from '../mocks/puppeteer.mock';
import { createMockState, createMockStateWithBrowser } from '../mocks/state.mock';
import type { ServerState } from '../../../src/types';

describe('handleNewPage', () => {
  it('should create a new page with the given pageId', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: mockPage });
    const state = createMockState({ browser: mockBrowser });

    const result = await handleNewPage({ pageId: 'test-page' }, state);

    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(state.pages.get('test-page')).toBe(mockPage);
    expect(result.content[0].text).toBe('Page test-page created successfully');
  });

  it('should apply stored viewport to new page', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: mockPage });
    const state = createMockState({ browser: mockBrowser });
    state.currentViewport = { width: 1920, height: 1080 };

    await handleNewPage({ pageId: 'test-page' }, state);

    expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1920, height: 1080 });
  });

  it('should not set viewport if none is stored', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: mockPage });
    const state = createMockState({ browser: mockBrowser });
    state.currentViewport = null;

    await handleNewPage({ pageId: 'test-page' }, state);

    expect(mockPage.setViewport).not.toHaveBeenCalled();
  });

  it('should throw if browser is not launched', async () => {
    const state = createMockState({ browser: null });

    await expect(handleNewPage({ pageId: 'test-page' }, state)).rejects.toThrow(
      'Browser not launched. Call puppeteer_launch first.'
    );
  });

  it('should overwrite existing page with same pageId', async () => {
    const existingPage = createMockPage();
    const newPage = createMockPage();
    const mockBrowser = createMockBrowser({ newPageMock: newPage });
    const state = createMockState({
      browser: mockBrowser,
      pages: new Map([['test-page', existingPage]]),
    });

    await handleNewPage({ pageId: 'test-page' }, state);

    expect(state.pages.get('test-page')).toBe(newPage);
  });

  it('should handle browser.newPage failure', async () => {
    const mockBrowser = createMockBrowser({
      newPageError: new Error('Failed to create page'),
    });
    const state = createMockState({ browser: mockBrowser });

    await expect(handleNewPage({ pageId: 'test-page' }, state)).rejects.toThrow(
      'Failed to create page'
    );
  });
});

describe('handleClosePage', () => {
  it('should close the page and remove from state', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['test-page', mockPage]]);

    const result = await handleClosePage({ pageId: 'test-page' }, state);

    expect(mockPage.close).toHaveBeenCalled();
    expect(state.pages.has('test-page')).toBe(false);
    expect(result.content[0].text).toBe('Page test-page closed');
  });

  it('should throw if pageId is not found', async () => {
    const state = createMockStateWithBrowser();

    await expect(handleClosePage({ pageId: 'unknown' }, state)).rejects.toThrow(
      'Page unknown not found'
    );
  });

  it('should handle page.close failure', async () => {
    const mockPage = createMockPage();
    (mockPage.close as any).mockRejectedValue(new Error('Close failed'));
    const state = createMockStateWithBrowser([['test-page', mockPage]]);

    await expect(handleClosePage({ pageId: 'test-page' }, state)).rejects.toThrow(
      'Close failed'
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

      expect(state.pages.get('page-with_special.chars:123')).toBe(mockPage);
      expect(result.content[0].text).toBe('Page page-with_special.chars:123 created successfully');
    });

    it('should handle pageId with unicode', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser({ newPageMock: mockPage });
      const state = createMockState({ browser: mockBrowser });

      await handleNewPage({ pageId: 'ページ-日本語' }, state);

      expect(state.pages.get('ページ-日本語')).toBe(mockPage);
    });

    it('should handle very long pageId', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser({ newPageMock: mockPage });
      const state = createMockState({ browser: mockBrowser });
      const longId = 'page-' + 'a'.repeat(500);

      await handleNewPage({ pageId: longId }, state);

      expect(state.pages.get(longId)).toBe(mockPage);
    });

    it('should handle creating many pages', async () => {
      const mockBrowser = createMockBrowser();
      const state = createMockState({ browser: mockBrowser });

      for (let i = 0; i < 20; i++) {
        await handleNewPage({ pageId: `page${i}` }, state);
      }

      expect(state.pages.size).toBe(20);
    });

    it('should handle empty string pageId', async () => {
      const mockPage = createMockPage();
      const mockBrowser = createMockBrowser({ newPageMock: mockPage });
      const state = createMockState({ browser: mockBrowser });

      await handleNewPage({ pageId: '' }, state);

      expect(state.pages.get('')).toBe(mockPage);
    });
  });

  describe('handleClosePage edge cases', () => {
    it('should handle closing last page', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['last-page', mockPage]]);

      await handleClosePage({ pageId: 'last-page' }, state);

      expect(state.pages.size).toBe(0);
    });

    it('should handle closing one of many pages', async () => {
      const pages: Array<[string, any]> = [
        ['page1', createMockPage()],
        ['page2', createMockPage()],
        ['page3', createMockPage()],
      ];
      const state = createMockStateWithBrowser(pages);

      await handleClosePage({ pageId: 'page2' }, state);

      expect(state.pages.size).toBe(2);
      expect(state.pages.has('page1')).toBe(true);
      expect(state.pages.has('page2')).toBe(false);
      expect(state.pages.has('page3')).toBe(true);
    });

    it('should handle pageId with spaces', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page with spaces', mockPage]]);

      const result = await handleClosePage({ pageId: 'page with spaces' }, state);

      expect(result.content[0].text).toBe('Page page with spaces closed');
      expect(state.pages.has('page with spaces')).toBe(false);
    });
  });
});
