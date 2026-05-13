import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvaluate, handleWaitForSelector } from '../../../src/handlers/evaluation';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';
import { assertCalledWith, rejectWith } from '../_helpers';

describe('handleEvaluate', () => {
  it('should execute script and return result', async () => {
    const mockPage = createMockPage({ evalResult: { foo: 'bar' } });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate(
      { pageId: 'page1', script: 'return { foo: "bar" }' },
      state
    );

    assertCalledWith(mockPage.evaluate as any, 'return { foo: "bar" }');
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'evaluated');
    assert.deepEqual(sc.result, { foo: 'bar' });
    assert.equal(sc.pageId, 'page1');
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleEvaluate({ pageId: 'unknown', script: '1 + 1' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should handle undefined result', async () => {
    const mockPage = createMockPage({ evalResult: undefined });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'void 0' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'evaluated');
    assert.equal(sc.result, undefined);
  });

  it('should handle null result', async () => {
    const mockPage = createMockPage({ evalResult: null });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'null' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.result, null);
  });

  it('should handle array result', async () => {
    const mockPage = createMockPage({ evalResult: [1, 2, 3] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '[1, 2, 3]' }, state);

    const sc = result.structuredContent as any;
    assert.deepEqual(sc.result, [1, 2, 3]);
  });

  it('should handle numeric result', async () => {
    const mockPage = createMockPage({ evalResult: 42 });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '40 + 2' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.result, 42);
  });

  it('should handle string result', async () => {
    const mockPage = createMockPage({ evalResult: 'hello' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate(
      { pageId: 'page1', script: '"hello"' },
      state
    );

    const sc = result.structuredContent as any;
    assert.equal(sc.result, 'hello');
  });

  it('should propagate script execution errors', async () => {
    const mockPage = createMockPage();
    rejectWith(mockPage.evaluate as any, new Error('ReferenceError: foo is not defined'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleEvaluate({ pageId: 'page1', script: 'foo.bar' }, state),
      { message: 'ReferenceError: foo is not defined' }
    );
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

    assertCalledWith(mockPage.waitForSelector as any, '#element', { timeout: 30000 });
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'selector_appeared');
    assert.equal(sc.selector, '#element');
    assert.equal(sc.pageId, 'page1');
  });

  it('should use custom timeout', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleWaitForSelector(
      { pageId: 'page1', selector: '#element', timeout: 5000 },
      state
    );

    assertCalledWith(mockPage.waitForSelector as any, '#element', { timeout: 5000 });
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleWaitForSelector({ pageId: 'unknown', selector: '#element' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should propagate timeout errors', async () => {
    const mockPage = createMockPage({
      waitForSelectorError: new Error('Timeout waiting for selector'),
    });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleWaitForSelector({ pageId: 'page1', selector: '#slow' }, state),
      { message: 'Timeout waiting for selector' }
    );
  });

  it('should handle zero timeout', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleWaitForSelector(
      { pageId: 'page1', selector: '#element', timeout: 0 },
      state
    );

    assertCalledWith(mockPage.waitForSelector as any, '#element', { timeout: 0 });
  });
});

describe('handleEvaluate edge cases', () => {
  it('should handle script returning boolean', async () => {
    const mockPage = createMockPage({ evalResult: true });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'true' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.result, true);
  });

  it('should handle script returning empty object', async () => {
    const mockPage = createMockPage({ evalResult: {} });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '({})' }, state);

    const sc = result.structuredContent as any;
    assert.deepEqual(sc.result, {});
  });

  it('should handle script returning empty array', async () => {
    const mockPage = createMockPage({ evalResult: [] });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: '[]' }, state);

    const sc = result.structuredContent as any;
    assert.deepEqual(sc.result, []);
  });

  it('should handle script returning nested object', async () => {
    const mockPage = createMockPage({
      evalResult: { a: { b: { c: [1, 2, 3] } } },
    });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'nested' }, state);

    const sc = result.structuredContent as any;
    assert.deepEqual(sc.result, { a: { b: { c: [1, 2, 3] } } });
  });

  it('should handle script returning NaN', async () => {
    const mockPage = createMockPage({ evalResult: NaN });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'NaN' }, state);

    const sc = result.structuredContent as any;
    // Raw value is NaN now (not stringified)
    assert.ok(Number.isNaN(sc.result));
  });

  it('should handle script returning Infinity', async () => {
    const mockPage = createMockPage({ evalResult: Infinity });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate({ pageId: 'page1', script: 'Infinity' }, state);

    const sc = result.structuredContent as any;
    assert.equal(sc.result, Infinity);
  });

  it('should handle very long script', async () => {
    const mockPage = createMockPage({ evalResult: 'done' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const longScript = '// ' + 'comment '.repeat(1000) + '\n"done"';

    await handleEvaluate({ pageId: 'page1', script: longScript }, state);

    assertCalledWith(mockPage.evaluate as any, longScript);
  });

  it('should handle script with unicode', async () => {
    const mockPage = createMockPage({ evalResult: '日本語' });
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleEvaluate(
      { pageId: 'page1', script: '"日本語"' },
      state
    );

    const sc = result.structuredContent as any;
    assert.equal(sc.result, '日本語');
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

    assertCalledWith(mockPage.waitForSelector as any, '#element', { timeout: 300000 });
  });

  it('should handle complex CSS selector', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const complexSelector = 'div.container > ul.list li:not(.hidden):first-of-type a[href^="https"]';

    await handleWaitForSelector({ pageId: 'page1', selector: complexSelector }, state);

    assertCalledWith(mockPage.waitForSelector as any, complexSelector, { timeout: 30000 });
  });

  it('should handle selector with pseudo-elements', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleWaitForSelector(
      { pageId: 'page1', selector: 'button:hover' },
      state
    );

    assertCalledWith(mockPage.waitForSelector as any, 'button:hover', { timeout: 30000 });
  });
});
