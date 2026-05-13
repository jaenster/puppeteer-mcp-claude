import { mock } from 'node:test';
import type { Page, Browser, HTTPRequest } from 'puppeteer';

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

export function createMockPage(options: MockPageOptions = {}): Page {
  const mockElement = {
    textContent: options.textContent ?? 'mock text',
  };

  const page = {
    goto: mock.fn(async (_url: unknown, _opts?: unknown) => {
      if (options.gotoError) throw options.gotoError;
      return { ok: () => true };
    }),
    click: mock.fn(async (_selector: unknown) => {
      if (options.clickError) throw options.clickError;
    }),
    type: mock.fn(async (_selector: unknown, _text: unknown) => {
      if (options.typeError) throw options.typeError;
    }),
    $: mock.fn(async (_selector: unknown) => {
      return options.elementExists !== false ? mockElement : null;
    }),
    evaluate: mock.fn(async (fnOrScript: unknown, ...args: unknown[]) => {
      if (typeof fnOrScript === 'function' && args.length > 0) {
        return 'textContent' in options ? options.textContent : 'mock text';
      }
      return 'evalResult' in options ? options.evalResult : 'mock result';
    }),
    evaluateOnNewDocument: mock.fn(async () => undefined),
    screenshot: mock.fn(async (_opts?: unknown) => {
      return options.screenshotBuffer ?? Buffer.from('mock-png');
    }),
    waitForSelector: mock.fn(async (_selector: unknown, _opts?: unknown) => {
      if (options.waitForSelectorError) throw options.waitForSelectorError;
      return mockElement;
    }),
    close: mock.fn(async () => undefined),
    setViewport: mock.fn(async (_v: unknown) => undefined),
    setUserAgent: mock.fn(async (_ua: unknown) => undefined),
    setCookie: mock.fn(async (..._c: unknown[]) => undefined),
    cookies: mock.fn(async (..._urls: unknown[]) => options.cookies ?? []),
    deleteCookie: mock.fn(async (..._c: unknown[]) => undefined),
    setRequestInterception: mock.fn(async (_enable: unknown) => undefined),
    on: mock.fn((_event: unknown, _handler: unknown) => undefined),
    removeAllListeners: mock.fn((_event?: unknown) => undefined),
  };

  return page as unknown as Page;
}

export interface MockBrowserOptions {
  pages?: Page[];
  newPageError?: Error;
  newPageMock?: Page;
}

export function createMockBrowser(options: MockBrowserOptions = {}): Browser {
  const defaultPage = createMockPage();
  const pages = options.pages ?? [defaultPage];

  const browser = {
    newPage: mock.fn(async () => {
      if (options.newPageError) throw options.newPageError;
      return options.newPageMock ?? createMockPage();
    }),
    pages: mock.fn(async () => pages),
    close: mock.fn(async () => undefined),
  };

  return browser as unknown as Browser;
}

export function createMockRequest(resourceType: string = 'document'): HTTPRequest {
  return {
    resourceType: mock.fn(() => resourceType),
    headers: mock.fn(() => ({})),
    abort: mock.fn(async () => undefined),
    continue: mock.fn(async () => undefined),
  } as unknown as HTTPRequest;
}
