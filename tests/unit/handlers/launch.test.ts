import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLaunch } from '../../../src/handlers/launch';
import { createMockBrowser, createMockPage } from '../mocks/puppeteer.mock';
import { createMockState, createMockLog } from '../mocks/state.mock';
import type { ServerState } from '../../../src/types';

// Mock puppeteer module
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(),
    connect: vi.fn(),
  },
}));

import puppeteer from 'puppeteer';

describe('handleLaunch', () => {
  let state: ServerState;
  let mockLog: ReturnType<typeof createMockLog>;
  let mockBrowser: ReturnType<typeof createMockBrowser>;

  beforeEach(() => {
    state = createMockState();
    mockLog = createMockLog();
    mockBrowser = createMockBrowser();
    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);
    vi.mocked(puppeteer.connect).mockResolvedValue(mockBrowser as any);
  });

  describe('basic launch', () => {
    it('should launch browser with default options', async () => {
      const result = await handleLaunch({}, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining(['--no-sandbox', '--disable-setuid-sandbox']),
        })
      );
      expect(state.browser).toBe(mockBrowser);
      expect(result.content[0].text).toBe('Browser launched successfully');
    });

    it('should launch in non-headless mode', async () => {
      await handleLaunch({ headless: false }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: false })
      );
    });

    it('should pass custom browser args', async () => {
      await handleLaunch({ args: ['--disable-gpu', '--no-zygote'] }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining([
            '--disable-gpu',
            '--no-zygote',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ]),
        })
      );
    });

    it('should use custom executablePath', async () => {
      await handleLaunch({ executablePath: '/path/to/chrome' }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ executablePath: '/path/to/chrome' })
      );
    });

    it('should use userDataDir', async () => {
      await handleLaunch({ userDataDir: '/path/to/profile' }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ userDataDir: '/path/to/profile' })
      );
    });

    it('should set slowMo delay', async () => {
      await handleLaunch({ slowMo: 100 }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ slowMo: 100 })
      );
    });
  });

  describe('existing browser cleanup', () => {
    it('should close existing browser before launching new one', async () => {
      const oldBrowser = createMockBrowser();
      state.browser = oldBrowser as any;

      await handleLaunch({}, state, mockLog);

      expect(oldBrowser.close).toHaveBeenCalled();
      expect(state.browser).toBe(mockBrowser);
    });
  });

  describe('WebSocket connection', () => {
    it('should connect via browserWSEndpoint', async () => {
      const result = await handleLaunch(
        { browserWSEndpoint: 'ws://localhost:9222' },
        state,
        mockLog
      );

      expect(puppeteer.connect).toHaveBeenCalledWith(
        expect.objectContaining({ browserWSEndpoint: 'ws://localhost:9222' })
      );
      expect(puppeteer.launch).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe('Connected to existing browser successfully');
    });

    it('should pass viewport to connect options', async () => {
      const viewport = { width: 1920, height: 1080 };
      await handleLaunch({ browserWSEndpoint: 'ws://localhost:9222', viewport }, state, mockLog);

      expect(puppeteer.connect).toHaveBeenCalledWith(
        expect.objectContaining({ defaultViewport: viewport })
      );
    });
  });

  describe('viewport handling', () => {
    it('should set viewport on default page', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      const viewport = { width: 1920, height: 1080 };
      await handleLaunch({ viewport }, state, mockLog);

      expect(mockPage.setViewport).toHaveBeenCalledWith(viewport);
      expect(state.currentViewport).toEqual(viewport);
    });

    it('should store viewport for new pages', async () => {
      const viewport = { width: 800, height: 600 };
      await handleLaunch({ viewport }, state, mockLog);

      expect(state.currentViewport).toEqual(viewport);
    });

    it('should use null defaultViewport when none specified', async () => {
      await handleLaunch({}, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ defaultViewport: null })
      );
    });
  });

  describe('user agent', () => {
    it('should set custom user agent', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      await handleLaunch({ userAgent: 'Custom UA' }, state, mockLog);

      expect(mockPage.setUserAgent).toHaveBeenCalledWith('Custom UA');
    });
  });

  describe('stealth mode', () => {
    it('should add stealth args when enabled', async () => {
      await handleLaunch({ stealth: true }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining([
            '--disable-blink-features=AutomationControlled',
            '--disable-extensions',
          ]),
        })
      );
    });

    it('should set stealth user agent', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      await handleLaunch({ stealth: true }, state, mockLog);

      expect(mockPage.setUserAgent).toHaveBeenCalledWith(
        expect.stringContaining('Mozilla/5.0')
      );
    });

    it('should inject anti-detection scripts', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      await handleLaunch({ stealth: true }, state, mockLog);

      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
    });

    it('should prefer custom userAgent over stealth default', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      await handleLaunch({ stealth: true, userAgent: 'Custom UA' }, state, mockLog);

      expect(mockPage.setUserAgent).toHaveBeenCalledWith('Custom UA');
    });
  });

  describe('proxy configuration', () => {
    it('should add proxy server arg', async () => {
      await handleLaunch({ proxy: { server: 'http://proxy:8080' } }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining(['--proxy-server=http://proxy:8080']),
        })
      );
    });

    it('should not add proxy arg if server not provided', async () => {
      await handleLaunch({ proxy: {} as any }, state, mockLog);

      const launchCall = vi.mocked(puppeteer.launch).mock.calls[0][0];
      expect(launchCall?.args).not.toContain(expect.stringContaining('--proxy-server'));
    });
  });

  describe('error handling', () => {
    it('should propagate launch errors', async () => {
      vi.mocked(puppeteer.launch).mockRejectedValue(new Error('Launch failed'));

      await expect(handleLaunch({}, state, mockLog)).rejects.toThrow('Launch failed');
    });

    it('should propagate connect errors', async () => {
      vi.mocked(puppeteer.connect).mockRejectedValue(new Error('Connection refused'));

      await expect(
        handleLaunch({ browserWSEndpoint: 'ws://invalid' }, state, mockLog)
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('edge cases', () => {
    it('should handle combined options (stealth + proxy + viewport)', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      await handleLaunch(
        {
          stealth: true,
          proxy: { server: 'http://proxy:8080' },
          viewport: { width: 1920, height: 1080 },
        },
        state,
        mockLog
      );

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining([
            '--proxy-server=http://proxy:8080',
            '--disable-blink-features=AutomationControlled',
          ]),
        })
      );
      expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1920, height: 1080 });
      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
    });

    it('should handle empty browser args array', async () => {
      await handleLaunch({ args: [] }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
      );
    });

    it('should handle viewport with all properties', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      const viewport = {
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        isLandscape: false,
      };

      await handleLaunch({ viewport }, state, mockLog);

      expect(mockPage.setViewport).toHaveBeenCalledWith(viewport);
      expect(state.currentViewport).toEqual(viewport);
    });

    it('should handle zero slowMo', async () => {
      await handleLaunch({ slowMo: 0 }, state, mockLog);

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ slowMo: 0 })
      );
    });

    it('should handle browser with no default pages', async () => {
      mockBrowser = createMockBrowser({ pages: [] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      // Should not throw even with stealth/viewport when no pages exist
      await handleLaunch({ stealth: true, viewport: { width: 800, height: 600 } }, state, mockLog);

      expect(state.browser).toBe(mockBrowser);
    });

    it('should handle proxy with empty server string', async () => {
      await handleLaunch({ proxy: { server: '' } }, state, mockLog);

      const launchCall = vi.mocked(puppeteer.launch).mock.calls[0][0];
      // Empty server should not add proxy arg
      expect(launchCall?.args?.some((arg: string) => arg.includes('--proxy-server'))).toBe(false);
    });

    it('should handle multiple sequential launches', async () => {
      const browser1 = createMockBrowser();
      const browser2 = createMockBrowser();
      vi.mocked(puppeteer.launch)
        .mockResolvedValueOnce(browser1 as any)
        .mockResolvedValueOnce(browser2 as any);

      await handleLaunch({}, state, mockLog);
      expect(state.browser).toBe(browser1);

      await handleLaunch({}, state, mockLog);
      expect(browser1.close).toHaveBeenCalled();
      expect(state.browser).toBe(browser2);
    });

    it('should handle userAgent with special characters', async () => {
      const mockPage = createMockPage();
      mockBrowser = createMockBrowser({ pages: [mockPage] });
      vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as any);

      const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) "Special & <Characters>"';
      await handleLaunch({ userAgent }, state, mockLog);

      expect(mockPage.setUserAgent).toHaveBeenCalledWith(userAgent);
    });
  });
});
