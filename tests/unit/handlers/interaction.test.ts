import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleClick, handleType, handleGetText } from '../../../src/handlers/interaction';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';
import { assertCalledWith } from '../_helpers';

describe('handleClick', () => {
  it('should click element by selector', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleClick({ pageId: 'page1', selector: '#button' }, state);

    assertCalledWith(mockPage.click as any, '#button');
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'clicked');
    assert.equal(sc.selector, '#button');
    assert.equal(sc.pageId, 'page1');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleClick({ pageId: 'unknown', selector: '#button' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should propagate click errors', async () => {
    const mockPage = createMockPage({ clickError: new Error('Element not found') });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleClick({ pageId: 'page1', selector: '#nonexistent' }, state),
      { message: 'Element not found' }
    );
  });

  it('should handle complex selectors', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick(
      { pageId: 'page1', selector: 'div.container > button[data-action="submit"]' },
      state
    );

    assertCalledWith(mockPage.click as any, 'div.container > button[data-action="submit"]');
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

    assertCalledWith(mockPage.type as any, '#input', 'Hello World');
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'typed');
    assert.equal(sc.text, 'Hello World');
    assert.equal(sc.selector, '#input');
    assert.equal(sc.pageId, 'page1');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleType({ pageId: 'unknown', selector: '#input', text: 'test' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should propagate type errors', async () => {
    const mockPage = createMockPage({ typeError: new Error('Cannot type into element') });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleType({ pageId: 'page1', selector: '#readonly', text: 'test' }, state),
      { message: 'Cannot type into element' }
    );
  });

  it('should handle empty text', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType({ pageId: 'page1', selector: '#input', text: '' }, state);

    assertCalledWith(mockPage.type as any, '#input', '');
  });

  it('should handle special characters', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const specialText = 'Hello\nWorld\t"quotes"';

    await handleType({ pageId: 'page1', selector: '#input', text: specialText }, state);

    assertCalledWith(mockPage.type as any, '#input', specialText);
  });
});

describe('handleGetText', () => {
  it('should get text content from element', async () => {
    const mockPage = createMockPage({ textContent: 'Hello World' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetText({ pageId: 'page1', selector: '#content' }, state);

    assertCalledWith(mockPage.$ as any, '#content');
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'text_extracted');
    assert.equal(sc.text, 'Hello World');
    assert.equal(sc.selector, '#content');
    assert.equal(sc.pageId, 'page1');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleGetText({ pageId: 'unknown', selector: '#content' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should throw when element is not found', async () => {
    const mockPage = createMockPage({ elementExists: false });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleGetText({ pageId: 'page1', selector: '#nonexistent' }, state),
      { message: 'Element #nonexistent not found' }
    );
  });

  it('should handle null text content', async () => {
    const mockPage = createMockPage({ textContent: null });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetText({ pageId: 'page1', selector: '#empty' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'text_extracted');
    assert.equal(sc.text, null);
    assert.equal(sc.selector, '#empty');
  });

  it('should handle whitespace-only content', async () => {
    const mockPage = createMockPage({ textContent: '   \n\t  ' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleGetText({ pageId: 'page1', selector: '#whitespace' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'text_extracted');
    assert.equal(sc.text, '   \n\t  ');
    assert.equal(sc.selector, '#whitespace');
  });

  describe('edge cases', () => {
    it('should handle very long text content', async () => {
      const longText = 'x'.repeat(10000);
      const mockPage = createMockPage({ textContent: longText });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleGetText({ pageId: 'page1', selector: '#long' }, state);

      const sc = result.structuredContent as any;
      assert.equal(sc.text, longText);
    });

    it('should handle HTML entities in text', async () => {
      const mockPage = createMockPage({ textContent: '&lt;script&gt;alert("xss")&lt;/script&gt;' });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleGetText({ pageId: 'page1', selector: '#entities' }, state);

      const sc = result.structuredContent as any;
      assert.equal(sc.text, '&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should handle unicode in text content', async () => {
      const mockPage = createMockPage({ textContent: '日本語テキスト 🎉 émojis' });
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleGetText({ pageId: 'page1', selector: '#unicode' }, state);

      const sc = result.structuredContent as any;
      assert.equal(sc.text, '日本語テキスト 🎉 émojis');
    });
  });
});

describe('handleClick edge cases', () => {
  it('should handle selectors with quotes', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick({ pageId: 'page1', selector: '[data-value="test\'s"]' }, state);

    assertCalledWith(mockPage.click as any, '[data-value="test\'s"]');
  });

  it('should handle :nth-child selectors', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick({ pageId: 'page1', selector: 'ul > li:nth-child(3)' }, state);

    assertCalledWith(mockPage.click as any, 'ul > li:nth-child(3)');
  });

  it('should handle XPath-like attribute selectors', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleClick({ pageId: 'page1', selector: '[aria-label*="Submit"]' }, state);

    assertCalledWith(mockPage.click as any, '[aria-label*="Submit"]');
  });
});

describe('handleType edge cases', () => {
  it('should handle unicode input', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType({ pageId: 'page1', selector: '#input', text: '日本語入力 🎉' }, state);

    assertCalledWith(mockPage.type as any, '#input', '日本語入力 🎉');
  });

  it('should handle very long text input', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const longText = 'a'.repeat(5000);

    await handleType({ pageId: 'page1', selector: '#input', text: longText }, state);

    assertCalledWith(mockPage.type as any, '#input', longText);
  });

  it('should handle text with HTML-like content', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType(
      { pageId: 'page1', selector: '#input', text: '<script>alert("xss")</script>' },
      state
    );

    assertCalledWith(mockPage.type as any, '#input', '<script>alert("xss")</script>');
  });

  it('should handle text with SQL-like content', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType(
      { pageId: 'page1', selector: '#input', text: "'; DROP TABLE users; --" },
      state
    );

    assertCalledWith(mockPage.type as any, '#input', "'; DROP TABLE users; --");
  });

  it('should handle text with escape sequences', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleType(
      { pageId: 'page1', selector: '#input', text: 'line1\\nline2\\ttab' },
      state
    );

    assertCalledWith(mockPage.type as any, '#input', 'line1\\nline2\\ttab');
  });
});
