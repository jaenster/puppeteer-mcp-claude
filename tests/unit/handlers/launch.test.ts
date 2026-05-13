import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { setPuppeteer, resetPuppeteer } from '../../../src/puppeteer';
import { handleLaunch } from '../../../src/handlers/launch';
import { createMockBrowser, createMockPage } from '../mocks/puppeteer.mock';
import { createMockState, createMockLog } from '../mocks/state.mock';
import type { ServerState } from '../../../src/types';
import {
  assertCalled,
  assertCalledWith,
  assertNotCalled,
  arrayContaining,
  stringContaining,
} from '../_helpers';

describe('handleLaunch', () => {
  let state: ServerState;
  let mockLog: ReturnType<typeof createMockLog>;
  let mockBrowser: ReturnType<typeof createMockBrowser>;
  let fakePuppeteer: {
    launch: ReturnType<typeof mock.fn>;
    connect: ReturnType<typeof mock.fn>;
  };

  beforeEach(() => {
    state = createMockState();
    mockLog = createMockLog();
    mockBrowser = createMockBrowser();
    fakePuppeteer = {
      launch: mock.fn(async () => mockBrowser),
      connect: mock.fn(async () => mockBrowser),
    };
    setPuppeteer(fakePuppeteer as any);
  });

  afterEach(() => {
    resetPuppeteer();
  });

  describe('basic launch', () => {
    it('should launch browser with default options', async () => {
      const result = await handleLaunch({}, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, {
        headless: true,
        args: arrayContaining(['--no-sandbox', '--disable-setuid-sandbox']),
      });
      assert.equal(state.browser, mockBrowser);
      const sc = result.structuredContent as any;
      assert.equal(sc.action, 'browser_launched');
      assert.equal(sc.ok, true);
    });

    it('should launch in non-headless mode', async () => {
      await handleLaunch({ headless: false }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, { headless: false });
    });

    it('should pass custom browser args', async () => {
      await handleLaunch({ args: ['--disable-gpu', '--no-zygote'] }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, {
        args: arrayContaining([
          '--disable-gpu',
          '--no-zygote',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ]),
      });
    });

    it('should use custom executablePath', async () => {
      await handleLaunch({ executablePath: '/path/to/chrome' }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, { executablePath: '/path/to/chrome' });
    });

    it('should use userDataDir', async () => {
      await handleLaunch({ userDataDir: '/path/to/profile' }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, { userDataDir: '/path/to/profile' });
    });

    it('should set slowMo delay', async () => {
      await handleLaunch({ slowMo: 100 }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, { slowMo: 100 });
    });
  });

  describe('existing browser cleanup', () => {
    it('should close existing browser before launching new one', async () => {
      const oldBrowser = createMockBrowser();
      state.browser = oldBrowser as any;

      await handleLaunch({}, state, mockLog);

      assertCalled(oldBrowser.close as any);
      assert.equal(state.browser, mockBrowser);
    });
  });

  describe('WebSocket connection', () => {
    it('should connect via browserWSEndpoint', async () => {
      const result = await handleLaunch(
        { browserWSEndpoint: 'ws://localhost:9222' },
        state,
        mockLog
      );

      assertCalledWith(fakePuppeteer.connect as any, {
        browserWSEndpoint: 'ws://localhost:9222',
      });
      assertNotCalled(fakePuppeteer.launch as any);
      const sc = result.structuredContent as any;
      assert.equal(sc.action, 'browser_connected');
      assert.equal(sc.ok, true);
    });

    it('should pass viewport to connect options', async () => {
      const viewport = { width: 1920, height: 1080 };
      await handleLaunch(
        { browserWSEndpoint: 'ws://localhost:9222', viewport },
        state,
        mockLog
      );

      assertCalledWith(fakePuppeteer.connect as any, { defaultViewport: viewport });
    });
  });

  describe('viewport handling', () => {
    it('should set viewport on default page', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      const viewport = { width: 1920, height: 1080 };
      await handleLaunch({ viewport }, state, mockLog);

      assertCalledWith(mockPage.setViewport as any, viewport);
      assert.deepEqual(state.currentViewport, viewport);
    });

    it('should store viewport for new pages', async () => {
      const viewport = { width: 800, height: 600 };
      await handleLaunch({ viewport }, state, mockLog);

      assert.deepEqual(state.currentViewport, viewport);
    });

    it('should use null defaultViewport when none specified', async () => {
      await handleLaunch({}, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, { defaultViewport: null });
    });
  });

  describe('user agent', () => {
    it('should set custom user agent', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      await handleLaunch({ userAgent: 'Custom UA' }, state, mockLog);

      assertCalledWith(mockPage.setUserAgent as any, 'Custom UA');
    });
  });

  describe('stealth mode', () => {
    it('should add stealth args when enabled', async () => {
      await handleLaunch({ stealth: true }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, {
        args: arrayContaining([
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
        ]),
      });
    });

    it('should set stealth user agent', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      await handleLaunch({ stealth: true }, state, mockLog);

      assertCalledWith(mockPage.setUserAgent as any, stringContaining('Mozilla/5.0'));
    });

    it('should inject anti-detection scripts', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      await handleLaunch({ stealth: true }, state, mockLog);

      assertCalled(mockPage.evaluateOnNewDocument as any);
    });

    it('should prefer custom userAgent over stealth default', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      await handleLaunch({ stealth: true, userAgent: 'Custom UA' }, state, mockLog);

      assertCalledWith(mockPage.setUserAgent as any, 'Custom UA');
    });
  });

  describe('proxy configuration', () => {
    it('should add proxy server arg', async () => {
      await handleLaunch({ proxy: { server: 'http://proxy:8080' } }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, {
        args: arrayContaining(['--proxy-server=http://proxy:8080']),
      });
    });

    it('should not add proxy arg if server not provided', async () => {
      await handleLaunch({ proxy: {} as any }, state, mockLog);

      const launchCall = (fakePuppeteer.launch as any).mock.calls[0].arguments[0];
      const args: string[] = launchCall?.args ?? [];
      assert.ok(!args.some((arg: string) => arg.includes('--proxy-server')));
    });
  });

  describe('error handling', () => {
    it('should propagate launch errors', async () => {
      fakePuppeteer.launch.mock.mockImplementation((() =>
        Promise.reject(new Error('Launch failed'))) as any);

      await assert.rejects(handleLaunch({}, state, mockLog), { message: 'Launch failed' });
    });

    it('should propagate connect errors', async () => {
      fakePuppeteer.connect.mock.mockImplementation((() =>
        Promise.reject(new Error('Connection refused'))) as any);

      await assert.rejects(
        handleLaunch({ browserWSEndpoint: 'ws://invalid' }, state, mockLog),
        { message: 'Connection refused' }
      );
    });
  });

  describe('edge cases', () => {
    it('should handle combined options (stealth + proxy + viewport)', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      await handleLaunch(
        {
          stealth: true,
          proxy: { server: 'http://proxy:8080' },
          viewport: { width: 1920, height: 1080 },
        },
        state,
        mockLog
      );

      assertCalledWith(fakePuppeteer.launch as any, {
        args: arrayContaining([
          '--proxy-server=http://proxy:8080',
          '--disable-blink-features=AutomationControlled',
        ]),
      });
      assertCalledWith(mockPage.setViewport as any, { width: 1920, height: 1080 });
      assertCalled(mockPage.evaluateOnNewDocument as any);
    });

    it('should handle empty browser args array', async () => {
      await handleLaunch({ args: [] }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    });

    it('should handle viewport with all properties', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      const viewport = {
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        isLandscape: false,
      };

      await handleLaunch({ viewport }, state, mockLog);

      assertCalledWith(mockPage.setViewport as any, viewport);
      assert.deepEqual(state.currentViewport, viewport);
    });

    it('should handle zero slowMo', async () => {
      await handleLaunch({ slowMo: 0 }, state, mockLog);

      assertCalledWith(fakePuppeteer.launch as any, { slowMo: 0 });
    });

    it('should handle browser with no default pages', async () => {
      mockBrowser = createMockBrowser({ pages: [] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      // Should not throw even with stealth/viewport when no pages exist
      await handleLaunch(
        { stealth: true, viewport: { width: 800, height: 600 } },
        state,
        mockLog
      );

      assert.equal(state.browser, mockBrowser);
    });

    it('should handle proxy with empty server string', async () => {
      await handleLaunch({ proxy: { server: '' } }, state, mockLog);

      const launchCall = (fakePuppeteer.launch as any).mock.calls[0].arguments[0];
      const args: string[] = launchCall?.args ?? [];
      // Empty server should not add proxy arg
      assert.equal(args.some((arg: string) => arg.includes('--proxy-server')), false);
    });

    it('should handle multiple sequential launches', async () => {
      const browser1 = createMockBrowser();
      const browser2 = createMockBrowser();
      fakePuppeteer.launch.mock.mockImplementationOnce((async () => browser1) as any, 0);
      fakePuppeteer.launch.mock.mockImplementationOnce((async () => browser2) as any, 1);

      await handleLaunch({}, state, mockLog);
      assert.equal(state.browser, browser1);

      await handleLaunch({}, state, mockLog);
      assertCalled(browser1.close as any);
      assert.equal(state.browser, browser2);
    });

    it('should handle userAgent with special characters', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      fakePuppeteer.launch.mock.mockImplementation((async () => mockBrowser) as any);

      const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) "Special & <Characters>"';
      await handleLaunch({ userAgent }, state, mockLog);

      assertCalledWith(mockPage.setUserAgent as any, userAgent);
    });
  });
});
