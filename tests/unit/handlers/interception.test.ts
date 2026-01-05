import { describe, it, expect, vi } from 'vitest';
import { handleSetRequestInterception } from '../../../src/handlers/interception';
import { createMockPage, createMockRequest } from '../mocks/puppeteer.mock';
import { createMockStateWithBrowser } from '../mocks/state.mock';

describe('handleSetRequestInterception', () => {
  it('should enable interception', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleSetRequestInterception(
      { pageId: 'page1', enable: true },
      state
    );

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    expect(result.content[0].text).toBe('Request interception enabled for page page1');
  });

  it('should disable interception', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    const result = await handleSetRequestInterception(
      { pageId: 'page1', enable: false },
      state
    );

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(false);
    expect(mockPage.on).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe('Request interception disabled for page page1');
  });

  it('should default to enable=true', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleSetRequestInterception({ pageId: 'page1' }, state);

    expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
  });

  it('should throw for unknown pageId', async () => {
    const state = createMockStateWithBrowser();

    await expect(
      handleSetRequestInterception({ pageId: 'unknown' }, state)
    ).rejects.toThrow('Page unknown not found');
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
      ([event]: [string]) => event === 'request'
    )?.[1];
    expect(requestHandler).toBeDefined();

    // Test blocking an image request
    const imageRequest = createMockRequest('image');
    await requestHandler(imageRequest);
    expect(imageRequest.abort).toHaveBeenCalled();

    // Test allowing a document request
    const docRequest = createMockRequest('document');
    await requestHandler(docRequest);
    expect(docRequest.continue).toHaveBeenCalled();
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
      ([event]: [string]) => event === 'request'
    )?.[1];

    const request = createMockRequest('document');
    await requestHandler(request);

    expect(request.continue).toHaveBeenCalledWith({
      headers: expect.objectContaining(customHeaders),
    });
  });

  it('should handle empty blockResources array', async () => {
    const mockPage = createMockPage();
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await handleSetRequestInterception(
      { pageId: 'page1', blockResources: [] },
      state
    );

    const requestHandler = (mockPage.on as any).mock.calls.find(
      ([event]: [string]) => event === 'request'
    )?.[1];

    const request = createMockRequest('script');
    await requestHandler(request);

    expect(request.abort).not.toHaveBeenCalled();
    expect(request.continue).toHaveBeenCalled();
  });

  it('should propagate setRequestInterception errors', async () => {
    const mockPage = createMockPage();
    (mockPage.setRequestInterception as any).mockRejectedValue(
      new Error('Interception failed')
    );
    const state = createMockStateWithBrowser([['page1', mockPage]]);

    await expect(
      handleSetRequestInterception({ pageId: 'page1' }, state)
    ).rejects.toThrow('Interception failed');
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
        ([event]: [string]) => event === 'request'
      )?.[1];

      // All types should be blocked
      for (const type of allTypes) {
        const request = createMockRequest(type);
        await requestHandler(request);
        expect(request.abort).toHaveBeenCalled();
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
        ([event]: [string]) => event === 'request'
      )?.[1];

      const request = createMockRequest('document');
      await requestHandler(request);

      expect(request.continue).toHaveBeenCalledWith({
        headers: expect.objectContaining(headers),
      });
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
        ([event]: [string]) => event === 'request'
      )?.[1];

      const request = createMockRequest('xhr');
      await requestHandler(request);

      expect(request.continue).toHaveBeenCalledWith({
        headers: expect.objectContaining(headers),
      });
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
        ([event]: [string]) => event === 'request'
      )?.[1];

      // Image should be blocked
      const imageRequest = createMockRequest('image');
      await requestHandler(imageRequest);
      expect(imageRequest.abort).toHaveBeenCalled();

      // XHR should continue with modified headers
      const xhrRequest = createMockRequest('xhr');
      await requestHandler(xhrRequest);
      expect(xhrRequest.continue).toHaveBeenCalledWith({
        headers: expect.objectContaining({ 'X-Custom': 'test' }),
      });
    });

    it('should handle request interception toggle', async () => {
      const mockPage = createMockPage();
      const state = createMockStateWithBrowser([['page1', mockPage]]);

      // Enable
      await handleSetRequestInterception({ pageId: 'page1', enable: true }, state);
      expect(mockPage.setRequestInterception).toHaveBeenLastCalledWith(true);

      // Disable
      await handleSetRequestInterception({ pageId: 'page1', enable: false }, state);
      expect(mockPage.setRequestInterception).toHaveBeenLastCalledWith(false);
    });
  });
});
