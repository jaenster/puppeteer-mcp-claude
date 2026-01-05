import { describe, it, expect, vi } from 'vitest';
import { handleCloseBrowser } from '../../../src/handlers/browser';
import { createMockBrowser, createMockPage } from '../mocks/puppeteer.mock';
import { createMockState, createMockStateWithBrowser } from '../mocks/state.mock';

describe('handleCloseBrowser', () => {
  it('should close browser and clear pages', async () => {
    const mockPage = createMockPage();
    const mockBrowser = createMockBrowser();
    const state = createMockState({
      browser: mockBrowser,
      pages: new Map([['page1', mockPage]]),
    });

    const result = await handleCloseBrowser({}, state);

    expect(mockBrowser.close).toHaveBeenCalled();
    expect(state.browser).toBeNull();
    expect(state.pages.size).toBe(0);
    expect(result.content[0].text).toBe('Browser closed');
  });

  it('should handle no browser launched', async () => {
    const state = createMockState({ browser: null });

    const result = await handleCloseBrowser({}, state);

    expect(state.browser).toBeNull();
    expect(result.content[0].text).toBe('Browser closed');
  });

  it('should clear multiple pages', async () => {
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

    expect(state.pages.size).toBe(0);
  });

  it('should propagate browser.close errors', async () => {
    const mockBrowser = createMockBrowser();
    (mockBrowser.close as any).mockRejectedValue(new Error('Close failed'));
    const state = createMockState({ browser: mockBrowser });

    await expect(handleCloseBrowser({}, state)).rejects.toThrow('Close failed');
  });

  it('should be idempotent when called multiple times', async () => {
    const mockBrowser = createMockBrowser();
    const state = createMockState({ browser: mockBrowser });

    await handleCloseBrowser({}, state);
    const result = await handleCloseBrowser({}, state);

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    expect(result.content[0].text).toBe('Browser closed');
  });
});
