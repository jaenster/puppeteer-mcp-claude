import { describe, it, expect, vi } from 'vitest';
import { handleScreenshot } from '../../../src/handlers/screenshot';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';

describe('handleScreenshot', () => {
  it('should take screenshot with path', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleScreenshot(
      { pageId: 'page1', path: '/tmp/screenshot.png' },
      state
    );

    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: '/tmp/screenshot.png',
      fullPage: false,
      type: 'png',
    });
    expect(result.content[0].text).toBe('Screenshot saved to /tmp/screenshot.png');
  });

  it('should take screenshot without path', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleScreenshot({ pageId: 'page1' }, state);

    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: undefined,
      fullPage: false,
      type: 'png',
    });
    expect(result.content[0].text).toBe('Screenshot taken');
  });

  it('should take full page screenshot', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleScreenshot(
      { pageId: 'page1', path: '/tmp/full.png', fullPage: true },
      state
    );

    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: '/tmp/full.png',
      fullPage: true,
      type: 'png',
    });
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleScreenshot({ pageId: 'unknown' }, state)
    ).rejects.toThrow('Page unknown not found');
  });

  it('should propagate screenshot errors', async () => {
    const mockPage = createMockPage();
    (mockPage.screenshot as any).mockRejectedValue(new Error('Failed to capture'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleScreenshot({ pageId: 'page1', path: '/invalid/path.png' }, state)
    ).rejects.toThrow('Failed to capture');
  });

  it('should default fullPage to false', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleScreenshot({ pageId: 'page1' }, state);

    expect(mockPage.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ fullPage: false })
    );
  });

  describe('edge cases', () => {
    it('should handle path with spaces', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleScreenshot(
        { pageId: 'page1', path: '/tmp/my screenshots/test image.png' },
        state
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/tmp/my screenshots/test image.png' })
      );
    });

    it('should handle path with unicode characters', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleScreenshot(
        { pageId: 'page1', path: '/tmp/スクリーンショット.png' },
        state
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/tmp/スクリーンショット.png' })
      );
    });

    it('should handle relative path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleScreenshot(
        { pageId: 'page1', path: './screenshots/test.png' },
        state
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({ path: './screenshots/test.png' })
      );
    });

    it('should handle very long path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const longPath = '/tmp/' + 'a'.repeat(200) + '/screenshot.png';

      await handleScreenshot({ pageId: 'page1', path: longPath }, state);

      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({ path: longPath })
      );
    });

    it('should handle fullPage=true with path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleScreenshot(
        { pageId: 'page1', path: '/tmp/full.png', fullPage: true },
        state
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: '/tmp/full.png',
        fullPage: true,
        type: 'png',
      });
      expect(result.content[0].text).toBe('Screenshot saved to /tmp/full.png');
    });

    it('should handle fullPage=true without path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleScreenshot(
        { pageId: 'page1', fullPage: true },
        state
      );

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: undefined,
        fullPage: true,
        type: 'png',
      });
      expect(result.content[0].text).toBe('Screenshot taken');
    });
  });
});
