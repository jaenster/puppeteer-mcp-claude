import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleSetRequestInterception } from '../../../src/handlers/interception';
import { createMockPage, createMockRequest } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';
import {
  assertCalled,
  assertCalledWith,
  assertNotCalled,
  rejectWith,
} from '../_helpers';

describe('handleSetRequestInterception', () => {
  it('should enable interception', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleSetRequestInterception(
      { pageId: 'page1', enable: true },
      state
    );

    assertCalledWith(mockPage.setRequestInterception as any, true);
    // verify on('request', <Function>) was called
    const onCalls = (mockPage.on as any).mock.calls;
    const requestCall = onCalls.find(
      (c: any) => c.arguments[0] === 'request' && typeof c.arguments[1] === 'function'
    );
    assert.ok(requestCall, 'Expected page.on("request", fn) to be called');
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'interception_configured');
    assert.equal(sc.enabled, true);
    assert.equal(sc.pageId, 'page1');
  });

  it('should disable interception', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleSetRequestInterception(
      { pageId: 'page1', enable: false },
      state
    );

    assertCalledWith(mockPage.setRequestInterception as any, false);
    assertNotCalled(mockPage.on as any);
    const sc = result.structuredContent as any;
    assert.equal(sc.action, 'interception_configured');
    assert.equal(sc.enabled, false);
    assert.equal(sc.pageId, 'page1');
  });

  it('should default to enable=true', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleSetRequestInterception({ pageId: 'page1' }, state);

    assertCalledWith(mockPage.setRequestInterception as any, true);
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await assert.rejects(
      handleSetRequestInterception({ pageId: 'unknown' }, state),
      { message: 'Page unknown not found' }
    );
  });

  it('should block specified resource types', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleSetRequestInterception(
      { pageId: 'page1', blockResources: ['image', 'stylesheet'] },
      state
    );

    // Get the request handler that was registered
    const requestHandler = (mockPage.on as any).mock.calls.find(
      (c: any) => c.arguments[0] === 'request'
    )?.arguments[1];
    assert.ok(requestHandler);

    // Test blocking an image request
    const imageRequest = createMockRequest('image');
    await requestHandler(imageRequest);
    assertCalled(imageRequest.abort as any);

    // Test allowing a document request
    const docRequest = createMockRequest('document');
    await requestHandler(docRequest);
    assertCalled(docRequest.continue as any);
  });

  it('should modify headers', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);
    const customHeaders = { 'X-Custom': 'value', Authorization: 'Bearer token' };

    await handleSetRequestInterception(
      { pageId: 'page1', modifyHeaders: customHeaders },
      state
    );

    const requestHandler = (mockPage.on as any).mock.calls.find(
      (c: any) => c.arguments[0] === 'request'
    )?.arguments[1];

    const request = createMockRequest('document');
    await requestHandler(request);

    assertCalledWith(request.continue as any, { headers: customHeaders });
  });

  it('should handle empty blockResources array', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleSetRequestInterception(
      { pageId: 'page1', blockResources: [] },
      state
    );

    const requestHandler = (mockPage.on as any).mock.calls.find(
      (c: any) => c.arguments[0] === 'request'
    )?.arguments[1];

    const request = createMockRequest('script');
    await requestHandler(request);

    assertNotCalled(request.abort as any);
    assertCalled(request.continue as any);
  });

  it('should propagate setRequestInterception errors', async () => {
    const mockPage = createMockPage();
    rejectWith(mockPage.setRequestInterception as any, new Error('Interception failed'));
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await assert.rejects(
      handleSetRequestInterception({ pageId: 'page1' }, state),
      { message: 'Interception failed' }
    );
  });

  describe('edge cases', () => {
    it('should handle blocking all resource types', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const allTypes = [
        'document', 'stylesheet', 'image', 'media', 'font', 'script',
        'texttrack', 'xhr', 'fetch', 'eventsource', 'websocket', 'manifest', 'other'
      ];

      await handleSetRequestInterception(
        { pageId: 'page1', blockResources: allTypes as any },
        state
      );

      const requestHandler = (mockPage.on as any).mock.calls.find(
        (c: any) => c.arguments[0] === 'request'
      )?.arguments[1];

      // All types should be blocked
      for (const type of allTypes) {
        const request = createMockRequest(type);
        await requestHandler(request);
        assertCalled(request.abort as any);
      }
    });

    it('should handle multiple header modifications', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const headers = {
        'X-Custom-1': 'value1',
        'X-Custom-2': 'value2',
        'Authorization': 'Bearer token123',
        'Accept-Language': 'en-US,en;q=0.9',
      };

      await handleSetRequestInterception(
        { pageId: 'page1', modifyHeaders: headers },
        state
      );

      const requestHandler = (mockPage.on as any).mock.calls.find(
        (c: any) => c.arguments[0] === 'request'
      )?.arguments[1];

      const request = createMockRequest('document');
      await requestHandler(request);

      assertCalledWith(request.continue as any, { headers });
    });

    it('should handle headers with special characters', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);
      const headers = {
        'X-Special': 'value with spaces and "quotes"',
        'Cookie': 'session=abc123; user=john',
      };

      await handleSetRequestInterception(
        { pageId: 'page1', modifyHeaders: headers },
        state
      );

      const requestHandler = (mockPage.on as any).mock.calls.find(
        (c: any) => c.arguments[0] === 'request'
      )?.arguments[1];

      const request = createMockRequest('xhr');
      await requestHandler(request);

      assertCalledWith(request.continue as any, { headers });
    });

    it('should handle combined blocking and header modification', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleSetRequestInterception(
        {
          pageId: 'page1',
          blockResources: ['image', 'font'],
          modifyHeaders: { 'X-Custom': 'test' },
        },
        state
      );

      const requestHandler = (mockPage.on as any).mock.calls.find(
        (c: any) => c.arguments[0] === 'request'
      )?.arguments[1];

      // Image should be blocked
      const imageRequest = createMockRequest('image');
      await requestHandler(imageRequest);
      assertCalled(imageRequest.abort as any);

      // XHR should continue with modified headers
      const xhrRequest = createMockRequest('xhr');
      await requestHandler(xhrRequest);
      assertCalledWith(xhrRequest.continue as any, { headers: { 'X-Custom': 'test' } });
    });

    it('drops existing request listeners before adding a new one (no listener stacking)', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      await handleSetRequestInterception({ pageId: 'page1', enable: true }, state);
      await handleSetRequestInterception({ pageId: 'page1', enable: true }, state);
      await handleSetRequestInterception({ pageId: 'page1', enable: true }, state);

      // Each call clears prior listeners; net result is exactly one active.
      const removeCalls = (mockPage.removeAllListeners as any).mock.calls.length;
      const onCalls = (mockPage.on as any).mock.calls.filter(
        (c: any) => c.arguments[0] === 'request'
      ).length;
      assert.equal(removeCalls, 3, 'removeAllListeners called once per invocation');
      assert.equal(onCalls, 3, 'page.on(request) called once per invocation');
      // The important invariant: removes precede adds, so handlers don't pile up.
    });

    it('should handle request interception toggle', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      // Enable
      await handleSetRequestInterception({ pageId: 'page1', enable: true }, state);
      {
        const calls = (mockPage.setRequestInterception as any).mock.calls;
        const last = calls[calls.length - 1];
        assert.equal(last.arguments[0], true);
      }

      // Disable
      await handleSetRequestInterception({ pageId: 'page1', enable: false }, state);
      {
        const calls = (mockPage.setRequestInterception as any).mock.calls;
        const last = calls[calls.length - 1];
        assert.equal(last.arguments[0], false);
      }
    });
  });
});
