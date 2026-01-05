import { describe, it, expect, vi } from 'vitest';
import { handleEvaluate, handleWaitForSelector } from '../../../src/handlers/evaluation';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';

describe('handleEvaluate', () => {
  it('should execute script and return result', async () => {
    const mockPage = createMockPage({ evalResult: { foo: 'bar' } });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate(
      { pageId: 'page1', script: 'return { foo: "bar" }' },
      state
    );

    expect(mockPage.evaluate).toHaveBeenCalledWith('return { foo: "bar" }');
    expect(result.content[0].text).toBe('Script result: {"foo":"bar"}');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleEvaluate({ pageId: 'unknown', script: '1 + 1' }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should handle undefined result', async () => {
    const mockPage = createMockPage({ evalResult: undefined });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'void 0' }, state);

    expect(result.content[0].text).toBe('Script result: undefined');
  });

  it('should handle null result', async () => {
    const mockPage = createMockPage({ evalResult: null });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'null' }, state);

    expect(result.content[0].text).toBe('Script result: null');
  });

  it('should handle array result', async () => {
    const mockPage = createMockPage({ evalResult: [1, 2, 3] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '[1, 2, 3]' }, state);

    expect(result.content[0].text).toBe('Script result: [1,2,3]');
  });

  it('should handle numeric result', async () => {
    const mockPage = createMockPage({ evalResult: 42 });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '40 + 2' }, state);

    expect(result.content[0].text).toBe('Script result: 42');
  });

  it('should handle string result', async () => {
    const mockPage = createMockPage({ evalResult: 'hello' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate(
      { pageId: 'page1', script: '"hello"' },
      state
    );

    expect(result.content[0].text).toBe('Script result: "hello"');
  });

  it('should propagate script execution errors', async () => {
    const mockPage = createMockPage();
    (mockPage.evaluate as any).mockRejectedValue(new Error('ReferenceError: foo is not defined'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleEvaluate({ pageId: 'page1', script: 'foo.bar' }, state)
    ).rejects.toThrow('ReferenceError: foo is not defined');
  });
});

describe('handleWaitForSelector', () => {
  it('should wait for selector with default timeout', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleWaitForSelector(
      { pageId: 'page1', selector: '#element' },
      state
    );

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', { timeout: 30000 });
    expect(result.content[0].text).toBe('Selector #element appeared');
  });

  it('should use custom timeout', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleWaitForSelector(
      { pageId: 'page1', selector: '#element', timeout: 5000 },
      state
    );

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', { timeout: 5000 });
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleWaitForSelector({ pageId: 'unknown', selector: '#element' }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should propagate timeout errors', async () => {
    const mockPage = createMockPage({
      waitForSelectorError: new Error('Timeout waiting for selector'),
    });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleWaitForSelector({ pageId: 'page1', selector: '#slow' }, state)
    ).rejects.toThrow('Timeout waiting for selector');
  });

  it('should handle zero timeout', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleWaitForSelector(
      { pageId: 'page1', selector: '#element', timeout: 0 },
      state
    );

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', { timeout: 0 });
  });
});

describe('handleEvaluate edge cases', () => {
  it('should handle script returning boolean', async () => {
    const mockPage = createMockPage({ evalResult: true });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'true' }, state);

    expect(result.content[0].text).toBe('Script result: true');
  });

  it('should handle script returning empty object', async () => {
    const mockPage = createMockPage({ evalResult: {} });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '({})' }, state);

    expect(result.content[0].text).toBe('Script result: {}');
  });

  it('should handle script returning empty array', async () => {
    const mockPage = createMockPage({ evalResult: [] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '[]' }, state);

    expect(result.content[0].text).toBe('Script result: []');
  });

  it('should handle script returning nested object', async () => {
    const mockPage = createMockPage({
      evalResult: { a: { b: { c: [1, 2, 3] } } },
    });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'nested' }, state);

    expect(result.content[0].text).toBe('Script result: {"a":{"b":{"c":[1,2,3]}}}');
  });

  it('should handle script returning NaN', async () => {
    const mockPage = createMockPage({ evalResult: NaN });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'NaN' }, state);

    expect(result.content[0].text).toBe('Script result: null'); // NaN serializes to null in JSON
  });

  it('should handle script returning Infinity', async () => {
    const mockPage = createMockPage({ evalResult: Infinity });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'Infinity' }, state);

    expect(result.content[0].text).toBe('Script result: null'); // Infinity serializes to null in JSON
  });

  it('should handle very long script', async () => {
    const mockPage = createMockPage({ evalResult: 'done' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const longScript = '// ' + 'comment '.repeat(1000) + '\n"done"';

    await handleEvaluate({ pageId: 'page1', script: longScript }, state);

    expect(mockPage.evaluate).toHaveBeenCalledWith(longScript);
  });

  it('should handle script with unicode', async () => {
    const mockPage = createMockPage({ evalResult: '日本語' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate(
      { pageId: 'page1', script: '"日本語"' },
      state
    );

    expect(result.content[0].text).toBe('Script result: "日本語"');
  });
});

describe('handleWaitForSelector edge cases', () => {
  it('should handle very large timeout', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleWaitForSelector(
      { pageId: 'page1', selector: '#element', timeout: 300000 },
      state
    );

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', { timeout: 300000 });
  });

  it('should handle complex CSS selector', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const complexSelector = 'div.container > ul.list li:not(.hidden):first-of-type a[href^="https"]';

    await handleWaitForSelector({ pageId: 'page1', selector: complexSelector }, state);

    expect(mockPage.waitForSelector).toHaveBeenCalledWith(complexSelector, { timeout: 30000 });
  });

  it('should handle selector with pseudo-elements', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleWaitForSelector(
      { pageId: 'page1', selector: 'button:hover' },
      state
    );

    expect(mockPage.waitForSelector).toHaveBeenCalledWith('button:hover', { timeout: 30000 });
  });
});
