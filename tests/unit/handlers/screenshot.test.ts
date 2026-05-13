import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleScreenshot } from '../../../src/handlers/screenshot';
import { createMockPage } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';
import { assertCalledWith, rejectWith } from '../_helpers';

const EXPECTED_PNG_BASE64 = Buffer.from('mock-png').toString('base64');

function assertImageBlock(result: any, expectedData?: string) {
  const img = result.content[1] as any;
  assert.equal(img.type, 'image');
  assert.equal(img.mimeType, 'image/png');
  assert.ok(typeof img.data === 'string' && img.data.length > 0);
  if (expectedData !== undefined) {
    assert.equal(img.data, expectedData);
  }
}

describe('handleScreenshot', () => {
  it('should take screenshot with path', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleScreenshot(
      { pageId: 'page1', path: '/tmp/screenshot.png' },
      state
    );

    assertCalledWith(mockPage.screenshot as any, {
      path: '/tmp/screenshot.png',
      fullPage: false,
      type: 'png',
    });
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'screenshot_taken');
    assert.equal(sc.path, '/tmp/screenshot.png');
    assert.equal(sc.fullPage, false);
    assertImageBlock(result, EXPECTED_PNG_BASE64);
  });

  it('should take screenshot without path', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleScreenshot({ pageId: 'page1' }, state);

    assertCalledWith(mockPage.screenshot as any, {
      path: undefined,
      fullPage: false,
      type: 'png',
    });
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'screenshot_taken');
    assert.equal(sc.path, null);
    assertImageBlock(result, EXPECTED_PNG_BASE64);
  });

  it('should take full page screenshot', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleScreenshot(
      { pageId: 'page1', path: '/tmp/full.png', fullPage: true },
      state
    );

    assertCalledWith(mockPage.screenshot as any, {
      path: '/tmp/full.png',
      fullPage: true,
      type: 'png',
    });
    assertImageBlock(result, EXPECTED_PNG_BASE64);
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleScreenshot({ pageId: 'unknown' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should propagate screenshot errors', async () => {
    const mockPage = createMockPage();
    rejectWith(mockPage.screenshot as any, new Error('Failed to capture'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleScreenshot({ pageId: 'page1', path: '/invalid/path.png' }, state),
      { message: 'Failed to capture' }
    );
  });

  it('should default fullPage to false', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleScreenshot({ pageId: 'page1' }, state);

    assertCalledWith(mockPage.screenshot as any, { fullPage: false });
    assertImageBlock(result, EXPECTED_PNG_BASE64);
  });

  describe('edge cases', () => {
    it('should handle path with spaces', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleScreenshot(
        { pageId: 'page1', path: '/tmp/my screenshots/test image.png' },
        state
      );

      assertCalledWith(mockPage.screenshot as any, {
        path: '/tmp/my screenshots/test image.png',
      });
      assertImageBlock(result, EXPECTED_PNG_BASE64);
    });

    it('should handle path with unicode characters', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleScreenshot(
        { pageId: 'page1', path: '/tmp/スクリーンショット.png' },
        state
      );

      assertCalledWith(mockPage.screenshot as any, {
        path: '/tmp/スクリーンショット.png',
      });
      assertImageBlock(result, EXPECTED_PNG_BASE64);
    });

    it('should handle relative path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleScreenshot(
        { pageId: 'page1', path: './screenshots/test.png' },
        state
      );

      assertCalledWith(mockPage.screenshot as any, { path: './screenshots/test.png' });
      assertImageBlock(result, EXPECTED_PNG_BASE64);
    });

    it('should handle very long path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const longPath = '/tmp/' + 'a'.repeat(200) + '/screenshot.png';

      const result = await handleScreenshot({ pageId: 'page1', path: longPath }, state);

      assertCalledWith(mockPage.screenshot as any, { path: longPath });
      assertImageBlock(result, EXPECTED_PNG_BASE64);
    });

    it('should handle fullPage=true with path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleScreenshot(
        { pageId: 'page1', path: '/tmp/full.png', fullPage: true },
        state
      );

      assertCalledWith(mockPage.screenshot as any, {
        path: '/tmp/full.png',
        fullPage: true,
        type: 'png',
      });
      const sc = result.structuredContent as any;
      assert.equal(sc.action, 'screenshot_taken');
      assert.equal(sc.path, '/tmp/full.png');
      assert.equal(sc.fullPage, true);
      assertImageBlock(result, EXPECTED_PNG_BASE64);
    });

    it('should handle fullPage=true without path', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      const result = await handleScreenshot(
        { pageId: 'page1', fullPage: true },
        state
      );

      assertCalledWith(mockPage.screenshot as any, {
        path: undefined,
        fullPage: true,
        type: 'png',
      });
      const sc = result.structuredContent as any;
      assert.equal(sc.action, 'screenshot_taken');
      assert.equal(sc.path, null);
      assert.equal(sc.fullPage, true);
      assertImageBlock(result, EXPECTED_PNG_BASE64);
    });
  });
});
