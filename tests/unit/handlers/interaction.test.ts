import { describe, it, expect, vi } from 'vitest';
import { handleClick, handleType, handleGetText } from '../../../src/handlers/interaction';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';

describe('handleClick', () => {
  it('should click element by selector', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleClick({ pageId: 'page1', selector: '#button' }, state);

    expect(mockPage.click).toHaveBeenCalledWith('#button');
    expect(result.content[0].text).toBe('Clicked on #button');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleClick({ pageId: 'unknown', selector: '#button' }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should propagate click errors', async () => {
    const mockPage = createMockPage({ clickError: new Error('Element not found') });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleClick({ pageId: 'page1', selector: '#nonexistent' }, state)
    ).rejects.toThrow('Element not found');
  });

  it('should handle complex selectors', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick(
      { pageId: 'page1', selector: 'div.container > button[data-action="submit"]' },
      state
    );

    expect(mockPage.click).toHaveBeenCalledWith('div.container > button[data-action="submit"]');
  });
});

describe('handleType', () => {
  it('should type text into element', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleType(
      { pageId: 'page1', selector: '#input', text: 'Hello World' },
      state
    );

    expect(mockPage.type).toHaveBeenCalledWith('#input', 'Hello World');
    expect(result.content[0].text).toBe('Typed "Hello World" into #input');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleType({ pageId: 'unknown', selector: '#input', text: 'test' }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should propagate type errors', async () => {
    const mockPage = createMockPage({ typeError: new Error('Cannot type into element') });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleType({ pageId: 'page1', selector: '#readonly', text: 'test' }, state)
    ).rejects.toThrow('Cannot type into element');
  });

  it('should handle empty text', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType({ pageId: 'page1', selector: '#input', text: '' }, state);

    expect(mockPage.type).toHaveBeenCalledWith('#input', '');
  });

  it('should handle special characters', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const specialText = 'Hello\nWorld\t"quotes"';

    await handleType({ pageId: 'page1', selector: '#input', text: specialText }, state);

    expect(mockPage.type).toHaveBeenCalledWith('#input', specialText);
  });
});

describe('handleGetText', () => {
  it('should get text content from element', async () => {
    const mockPage = createMockPage({ textContent: 'Hello World' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetText({ pageId: 'page1', selector: '#content' }, state);

    expect(mockPage.$).toHaveBeenCalledWith('#content');
    expect(result.content[0].text).toBe('Text from #content: Hello World');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleGetText({ pageId: 'unknown', selector: '#content' }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should throw when element is not found', async () => {
    const mockPage = createMockPage({ elementExists: false });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleGetText({ pageId: 'page1', selector: '#nonexistent' }, state)
    ).rejects.toThrow('Element #nonexistent not found');
  });

  it('should handle null text content', async () => {
    const mockPage = createMockPage({ textContent: null });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetText({ pageId: 'page1', selector: '#empty' }, state);

    expect(result.content[0].text).toBe('Text from #empty: null');
  });

  it('should handle whitespace-only content', async () => {
    const mockPage = createMockPage({ textContent: '   \n\t  ' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetText({ pageId: 'page1', selector: '#whitespace' }, state);

    expect(result.content[0].text).toBe('Text from #whitespace:    \n\t  ');
  });

  describe('edge cases', () => {
    it('should handle very long text content', async () => {
      const longText = 'x'.repeat(10000);
      const mockPage = createMockPage({ textContent: longText });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleGetText({ pageId: 'page1', selector: '#long' }, state);

      expect(result.content[0].text).toContain(longText);
    });

    it('should handle HTML entities in text', async () => {
      const mockPage = createMockPage({ textContent: '&lt;script&gt;alert("xss")&lt;/script&gt;' });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleGetText({ pageId: 'page1', selector: '#entities' }, state);

      expect(result.content[0].text).toContain('&lt;script&gt;');
    });

    it('should handle unicode in text content', async () => {
      const mockPage = createMockPage({ textContent: '日本語テキスト 🎉 émojis' });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleGetText({ pageId: 'page1', selector: '#unicode' }, state);

      expect(result.content[0].text).toContain('日本語テキスト 🎉 émojis');
    });
  });
});

describe('handleClick edge cases', () => {
  it('should handle selectors with quotes', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick({ pageId: 'page1', selector: '[data-value="test\'s"]' }, state);

    expect(mockPage.click).toHaveBeenCalledWith('[data-value="test\'s"]');
  });

  it('should handle :nth-child selectors', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick({ pageId: 'page1', selector: 'ul > li:nth-child(3)' }, state);

    expect(mockPage.click).toHaveBeenCalledWith('ul > li:nth-child(3)');
  });

  it('should handle XPath-like attribute selectors', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick({ pageId: 'page1', selector: '[aria-label*="Submit"]' }, state);

    expect(mockPage.click).toHaveBeenCalledWith('[aria-label*="Submit"]');
  });
});

describe('handleType edge cases', () => {
  it('should handle unicode input', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType({ pageId: 'page1', selector: '#input', text: '日本語入力 🎉' }, state);

    expect(mockPage.type).toHaveBeenCalledWith('#input', '日本語入力 🎉');
  });

  it('should handle very long text input', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const longText = 'a'.repeat(5000);

    await handleType({ pageId: 'page1', selector: '#input', text: longText }, state);

    expect(mockPage.type).toHaveBeenCalledWith('#input', longText);
  });

  it('should handle text with HTML-like content', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType(
      { pageId: 'page1', selector: '#input', text: '<script>alert("xss")</script>' },
      state
    );

    expect(mockPage.type).toHaveBeenCalledWith('#input', '<script>alert("xss")</script>');
  });

  it('should handle text with SQL-like content', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType(
      { pageId: 'page1', selector: '#input', text: "'; DROP TABLE users; --" },
      state
    );

    expect(mockPage.type).toHaveBeenCalledWith('#input', "'; DROP TABLE users; --");
  });

  it('should handle text with escape sequences', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType(
      { pageId: 'page1', selector: '#input', text: 'line1\\nline2\\ttab' },
      state
    );

    expect(mockPage.type).toHaveBeenCalledWith('#input', 'line1\\nline2\\ttab');
  });
});
