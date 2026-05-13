import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleNavigate } from '../../../src/handlers/navigation';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';
import { assertCalledWith } from '../_helpers';

describe('handleNavigate', () => {
  it('should navigate to URL with default waitUntil', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleNavigate(
      { pageId: 'page1', url: 'https://example.com' },
      state
    );

    assertCalledWith(mockPage.goto as any, 'https://example.com', { waitUntil: 'load' });
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'navigated');
    assert.equal(sc.url, 'https://example.com');
    assert.equal(sc.pageId, 'page1');
    assert.equal(sc.waitUntil, 'load');
  });

  it('should use custom waitUntil option', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleNavigate(
      { pageId: 'page1', url: 'https://example.com', waitUntil: 'networkidle0' },
      state
    );

    assertCalledWith(mockPage.goto as any, 'https://example.com', {
      waitUntil: 'networkidle0',
    });
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleNavigate({ pageId: 'unknown', url: 'https://example.com' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should propagate navigation errors', async () => {
    const mockPage = createMockPage({ gotoError: new Error('Navigation timeout') });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleNavigate({ pageId: 'page1', url: 'https://example.com' }, state),
      { message: 'Navigation timeout' }
    );
  });

  it('should handle different waitUntil values', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    for (const waitUntil of ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'] as const) {
      await handleNavigate({ pageId: 'page1', url: 'https://example.com', waitUntil }, state);
      const calls = (mockPage.goto as any).mock.calls;
      const last = calls[calls.length - 1];
      assert.deepEqual(Array.from(last.arguments), ['https://example.com', { waitUntil }]);
    }
  });

  it('should handle URLs with query parameters', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const url = 'https://example.com/search?q=test&page=1';

    await handleNavigate({ pageId: 'page1', url }, state);

    assertCalledWith(mockPage.goto as any, url, { waitUntil: 'load' });
  });

  it('should handle URLs with fragments', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const url = 'https://example.com/page#section';

    await handleNavigate({ pageId: 'page1', url }, state);

    assertCalledWith(mockPage.goto as any, url, { waitUntil: 'load' });
  });

  describe('edge cases', () => {
    it('should handle data URLs', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const url = 'data:text/html,<h1>Hello</h1>';

      await handleNavigate({ pageId: 'page1', url }, state);

      assertCalledWith(mockPage.goto as any, url, { waitUntil: 'load' });
    });

    it('should handle file protocol URLs', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const url = 'file:///tmp/test.html';

      await handleNavigate({ pageId: 'page1', url }, state);

      assertCalledWith(mockPage.goto as any, url, { waitUntil: 'load' });
    });

    it('should handle about:blank', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleNavigate({ pageId: 'page1', url: 'about:blank' }, state);

      assertCalledWith(mockPage.goto as any, 'about:blank', { waitUntil: 'load' });
    });

    it('should handle URLs with unicode characters', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const url = 'https://example.com/путь/日本語';

      await handleNavigate({ pageId: 'page1', url }, state);

      assertCalledWith(mockPage.goto as any, url, { waitUntil: 'load' });
    });

    it('should handle very long URLs', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const url = 'https://example.com/?' + 'a'.repeat(2000);

      await handleNavigate({ pageId: 'page1', url }, state);

      assertCalledWith(mockPage.goto as any, url, { waitUntil: 'load' });
    });

    it('should handle localhost URLs', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleNavigate({ pageId: 'page1', url: 'http://localhost:3000' }, state);

      assertCalledWith(mockPage.goto as any, 'http://localhost:3000', { waitUntil: 'load' });
    });

    it('should handle IP address URLs', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleNavigate({ pageId: 'page1', url: 'http://192.168.1.1:8080/path' }, state);

      assertCalledWith(mockPage.goto as any, 'http://192.168.1.1:8080/path', { waitUntil: 'load' });
    });

    it('should handle URLs with credentials', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const url = 'https://user:pass@example.com/secure';

      await handleNavigate({ pageId: 'page1', url }, state);

      assertCalledWith(mockPage.goto as any, url, { waitUntil: 'load' });
    });
  });
});
