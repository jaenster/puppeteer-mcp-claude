import { vi } from 'vitest';
import type { Page, Browser, ElementHandle, HTTPRequest } from 'puppeteer';

export interface MockPageOptions {
  gotoError?: Error;
  clickError?: Error;
  typeError?: Error;
  evalResult?: unknown;
  textContent?: string | null;
  elementExists?: boolean;
  screenshotBuffer?: Buffer;
  waitForSelectorError?: Error;
  cookies?: Array<{ name: string; value: string; domain?: string }>;
}

/**
 * Create a mock Puppeteer Page object
 */
export function createMockPage(options: MockPageOptions = {}): Page {
  const mockElement = {
    textContent: options.textContent ?? 'mock text',
  };

  const page = {
    goto: vi.fn().mockImplementation(async (_url, _opts) => {
      if (options.gotoError) throw options.gotoError;
      return { ok: () => true };
    }),
    click: vi.fn().mockImplementation(async (_selector) => {
      if (options.clickError) throw options.clickError;
    }),
    type: vi.fn().mockImplementation(async (_selector, _text) => {
      if (options.typeError) throw options.typeError;
    }),
    $: vi.fn().mockImplementation(async (_selector) => {
      return options.elementExists !== false ? mockElement : null;
    }),
    evaluate: vi.fn().mockImplementation(async (fnOrScript, ...args) => {
      if (typeof fnOrScript === 'function' && args.length > 0) {
        // When called with element like page.evaluate((el) => el.textContent, element)
        return 'textContent' in options ? options.textContent : 'mock text';
      }
      return 'evalResult' in options ? options.evalResult : 'mock result';
    }),
    evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(options.screenshotBuffer ?? Buffer.from('mock-png')),
    waitForSelector: vi.fn().mockImplementation(async (_selector, _opts) => {
      if (options.waitForSelectorError) throw options.waitForSelectorError;
      return mockElement;
    }),
    close: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setCookie: vi.fn().mockResolvedValue(undefined),
    cookies: vi.fn().mockResolvedValue(options.cookies ?? []),
    deleteCookie: vi.fn().mockResolvedValue(undefined),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };

  return page as unknown as Page;
}

export interface MockBrowserOptions {
  pages?: Page[];
  newPageError?: Error;
  newPageMock?: Page;
}

/**
 * Create a mock Puppeteer Browser object
 */
export function createMockBrowser(options: MockBrowserOptions = {}): Browser {
  const defaultPage = createMockPage();
  const pages = options.pages ?? [defaultPage];

  const browser = {
    newPage: vi.fn().mockImplementation(async () => {
      if (options.newPageError) throw options.newPageError;
      return options.newPageMock ?? createMockPage();
    }),
    pages: vi.fn().mockResolvedValue(pages),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return browser as unknown as Browser;
}

/**
 * Create a mock HTTP request for testing interception
 */
export function createMockRequest(resourceType: string = 'document'): HTTPRequest {
  return {
    resourceType: vi.fn().mockReturnValue(resourceType),
    headers: vi.fn().mockReturnValue({}),
    abort: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(undefined),
  } as unknown as HTTPRequest;
}
