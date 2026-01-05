import { describe, it, expect, vi } from 'vitest';
import {
  handleSetCookies,
  handleGetCookies,
  handleDeleteCookies,
} from '../../../src/handlers/cookies';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';

describe('handleSetCookies', () => {
  it('should set a single cookie', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [{ name: 'session', value: 'abc123' }];

    const result = await handleSetCookies({ pageId: 'page1', cookies }, state);

    expect(mockPage.setCookie).toHaveBeenCalledWith({ name: 'session', value: 'abc123' });
    expect(result.content[0].text).toBe('Set 1 cookie(s) for page page1');
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

    expect(mockPage.setCookie).toHaveBeenCalledWith(
      { name: 'session', value: 'abc' },
      { name: 'user', value: 'john' },
      { name: 'prefs', value: 'dark' }
    );
    expect(result.content[0].text).toBe('Set 3 cookie(s) for page page1');
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

    expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleSetCookies({ pageId: 'unknown', cookies: [] }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should propagate setCookie errors', async () => {
    const mockPage = createMockPage();
    (mockPage.setCookie as any).mockRejectedValue(new Error('Invalid cookie'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleSetCookies({ pageId: 'page1', cookies: [{ name: 'bad', value: '' }] }, state)
    ).rejects.toThrow('Invalid cookie');
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

    expect(mockPage.cookies).toHaveBeenCalledWith();
    expect(result.content[0].text).toContain('session');
    expect(result.content[0].text).toContain('abc');
  });

  it('should get cookies filtered by URLs', async () => {
    const mockPage = createMockPage({ cookies: [] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const urls = ['https://example.com', 'https://api.example.com'];

    await handleGetCookies({ pageId: 'page1', urls }, state);

    expect(mockPage.cookies).toHaveBeenCalledWith(...urls);
  });

  it('should return empty array when no cookies', async () => {
    const mockPage = createMockPage({ cookies: [] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetCookies({ pageId: 'page1' }, state);

    expect(result.content[0].text).toContain('[]');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(handleGetCookies({ pageId: 'unknown' }, state)).rejects.toThrow(
      'Page unknown not found'
    );
  });
});

describe('handleDeleteCookies', () => {
  it('should delete specified cookies', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [{ name: 'session' }, { name: 'user' }];

    const result = await handleDeleteCookies({ pageId: 'page1', cookies }, state);

    expect(mockPage.deleteCookie).toHaveBeenCalledWith(
      { name: 'session' },
      { name: 'user' }
    );
    expect(result.content[0].text).toBe('Deleted 2 cookie(s) from page page1');
  });

  it('should delete cookie with domain and path', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const cookies = [{ name: 'session', domain: '.example.com', path: '/app' }];

    await handleDeleteCookies({ pageId: 'page1', cookies }, state);

    expect(mockPage.deleteCookie).toHaveBeenCalledWith({
      name: 'session',
      domain: '.example.com',
      path: '/app',
    });
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleDeleteCookies({ pageId: 'unknown', cookies: [{ name: 'test' }] }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should propagate deleteCookie errors', async () => {
    const mockPage = createMockPage();
    (mockPage.deleteCookie as any).mockRejectedValue(new Error('Delete failed'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleDeleteCookies({ pageId: 'page1', cookies: [{ name: 'bad' }] }, state)
    ).rejects.toThrow('Delete failed');
  });
});

describe('cookie edge cases', () => {
  describe('handleSetCookies edge cases', () => {
    it('should handle cookie with special characters in name', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'special-cookie_123', value: 'test' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
    });

    it('should handle cookie with special characters in value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'token', value: 'abc=123&def=456' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
    });

    it('should handle cookie with unicode value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'lang', value: '日本語' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
    });

    it('should handle cookie with very long value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'big', value: 'x'.repeat(4096) }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
    });

    it('should handle empty cookie value', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [{ name: 'empty', value: '' }];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
    });

    it('should handle cookie with sameSite=None', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [
        { name: 'cross-site', value: 'data', secure: true, sameSite: 'None' as const },
      ];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
    });

    it('should handle cookie with past expiration', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = [
        { name: 'expired', value: 'old', expires: Date.now() / 1000 - 3600 },
      ];

      await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(cookies[0]);
    });

    it('should handle setting 10+ cookies at once', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const cookies = Array.from({ length: 15 }, (_, i) => ({
        name: `cookie${i}`,
        value: `value${i}`,
      }));

      const result = await handleSetCookies({ pageId: 'page1', cookies }, state);

      expect(mockPage.setCookie).toHaveBeenCalledWith(...cookies);
      expect(result.content[0].text).toBe('Set 15 cookie(s) for page page1');
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

      expect(mockPage.cookies).toHaveBeenCalledWith(...urls);
    });

    it('should handle getting cookies with empty URLs array', async () => {
      const mockPage = createMockPage({ cookies: [] });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleGetCookies({ pageId: 'page1', urls: [] }, state);

      // Empty array should still call cookies() with no arguments spread
      expect(mockPage.cookies).toHaveBeenCalled();
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

      expect(mockPage.deleteCookie).toHaveBeenCalledWith({ name: 'session' });
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

      expect(mockPage.deleteCookie).toHaveBeenCalledWith(...cookies);
    });
  });
});
