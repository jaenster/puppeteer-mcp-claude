import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleSetCookies,
  handleGetCookies,
  handleDeleteCookies,
} from '../../../src/handlers/cookies';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';
import { assertCalled, assertCalledWith, rejectWith } from '../_helpers';

describe('handleSetCookies', () => {
  it('should set a single cookie', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [{ name: 'session', value: 'abc123' }];

    const result = await handleSetCookies({ pageId: 'page1', cookies }, state);

    assertCalledWith(mockPage.setCookie as any, { name: 'session', value: 'abc123' });
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'cookies_set');
    assert.equal(sc.count, 1);
    assert.equal(sc.pageId, 'page1');
  });

  it('should set multiple cookies', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [
      { name: 'session', value: 'abc' },
      { name: 'user', value: 'john' },
      { name: 'prefs', value: 'dark' },
    ];

    const result = await handleSetCookies({ pageId: 'page1', cookies }, state);

    assertCalledWith(
      mockPage.setCookie as any,
      { name: 'session', value: 'abc' },
      { name: 'user', value: 'john' },
      { name: 'prefs', value: 'dark' }
    );
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'cookies_set');
    assert.equal(sc.count, 3);
    assert.equal(sc.pageId, 'page1');
  });

  it('should set cookie with all properties', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [
      {
        name: 'secure',
        value: 'data',
        domain: '.example.com',
        path: '/app',
        expires: Date.now() / 1000 + 3600,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict' as const,
      },
    ];

    await handleSetCookies({ pageId: 'page1', cookies }, state);

    assertCalledWith(mockPage.setCookie as any, cookies[0]);
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleSetCookies({ pageId: 'unknown', cookies: [] }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should propagate setCookie errors', async () => {
    const mockPage = createMockPage();
    rejectWith(mockPage.setCookie as any, new Error('Invalid cookie'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleSetCookies({ pageId: 'page1', cookies: [{ name: 'bad', value: '' }] }, state),
      { message: 'Invalid cookie' }
    );
  });
});

describe('handleGetCookies', () => {
  it('should get all cookies without URL filter', async () => {
    const mockCookies = [
      { name: 'session', value: 'abc', domain: '.example.com' },
      { name: 'user', value: 'john', domain: '.example.com' },
    ];
    const mockPage = createMockPage({ cookies: mockCookies });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetCookies({ pageId: 'page1' }, state);

    assertCalledWith(mockPage.cookies as any);
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'cookies_retrieved');
    assert.deepEqual(sc.cookies, mockCookies);
    assert.equal(sc.count, 2);
  });

  it('should get cookies filtered by URLs', async () => {
    const mockPage = createMockPage({ cookies: [] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const urls = ['https://example.com', 'https://api.example.com'];

    await handleGetCookies({ pageId: 'page1', urls }, state);

    assertCalledWith(mockPage.cookies as any, ...urls);
  });

  it('should return empty array when no cookies', async () => {
    const mockPage = createMockPage({ cookies: [] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetCookies({ pageId: 'page1' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'cookies_retrieved');
    assert.deepEqual(sc.cookies, []);
    assert.equal(sc.count, 0);
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleGetCookies({ pageId: 'unknown' }, state),
      { message: 'Page unknown not found' }
    );
  });
});

describe('handleDeleteCookies', () => {
  it('should delete specified cookies', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [{ name: 'session' }, { name: 'user' }];

    const result = await handleDeleteCookies({ pageId: 'page1', cookies }, state);

    assertCalledWith(
      mockPage.deleteCookie as any,
      { name: 'session' },
      { name: 'user' }
    );
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'cookies_deleted');
    assert.equal(sc.count, 2);
    assert.equal(sc.pageId, 'page1');
  });

  it('should delete cookie with domain and path', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [{ name: 'session', domain: '.example.com', path: '/app' }];

    await handleDeleteCookies({ pageId: 'page1', cookies }, state);

    assertCalledWith(mockPage.deleteCookie as any, {
      name: 'session',
      domain: '.example.com',
      path: '/app',
    });
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleDeleteCookies({ pageId: 'unknown', cookies: [{ name: 'test' }] }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should propagate deleteCookie errors', async () => {
    const mockPage = createMockPage();
    rejectWith(mockPage.deleteCookie as any, new Error('Delete failed'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleDeleteCookies({ pageId: 'page1', cookies: [{ name: 'bad' }] }, state),
      { message: 'Delete failed' }
    );
  });
});

describe('cookie edge cases', () => {
  describe('handleSetCookies edge cases', () => {
    it('should handle cookie with special characters in name', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'special-cookie_123', value: 'test' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, cookies[0]);
    });

    it('should handle cookie with special characters in value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'token', value: 'abc=123&def=456' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, cookies[0]);
    });

    it('should handle cookie with unicode value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'lang', value: '日本語' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, cookies[0]);
    });

    it('should handle cookie with very long value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'big', value: 'x'.repeat(4096) }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, cookies[0]);
    });

    it('should handle empty cookie value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'empty', value: '' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, cookies[0]);
    });

    it('should handle cookie with sameSite=None', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [
        { name: 'cross-site', value: 'data', secure: true, sameSite: 'None' as const },
      ];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, cookies[0]);
    });

    it('should handle cookie with past expiration', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [
        { name: 'expired', value: 'old', expires: Date.now() / 1000 - 3600 },
      ];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, cookies[0]);
    });

    it('should handle setting 10+ cookies at once', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = Array.from({ length: 15 }, (_, i) => ({
        name: `cookie${i}`,
        value: `value${i}`,
      }));

      const result = await handleSetCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.setCookie as any, ...cookies);
      const sc = result.structuredContent as any;
      assert.equal(sc.action, 'cookies_set');
      assert.equal(sc.count, 15);
      assert.equal(sc.pageId, 'page1');
    });
  });

  describe('handleGetCookies edge cases', () => {
    it('should handle getting cookies with multiple URLs', async () => {
      const mockPage = createMockPage({ cookies: [{ name: 'test', value: 'data' }] });
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const urls = [
        'https://example.com',
        'https://api.example.com',
        'https://cdn.example.com',
      ];

      await handleGetCookies({ pageId: 'page1', urls }, state);

      assertCalledWith(mockPage.cookies as any, ...urls);
    });

    it('should handle getting cookies with empty URLs array', async () => {
      const mockPage = createMockPage({ cookies: [] });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleGetCookies({ pageId: 'page1', urls: [] }, state);

      // Empty array should still call cookies() with no arguments spread
      assertCalled(mockPage.cookies as any);
    });
  });

  describe('handleDeleteCookies edge cases', () => {
    it('should handle deleting cookie with only name', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleDeleteCookies(
        { pageId: 'page1', cookies: [{ name: 'session' }] },
        state
      );

      assertCalledWith(mockPage.deleteCookie as any, { name: 'session' });
    });

    it('should handle deleting multiple cookies with different domains', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [
        { name: 'a', domain: '.example.com' },
        { name: 'b', domain: '.api.example.com' },
        { name: 'c', domain: 'localhost' },
      ];

      await handleDeleteCookies({ pageId: 'page1', cookies }, state);

      assertCalledWith(mockPage.deleteCookie as any, ...cookies);
    });
  });
});
