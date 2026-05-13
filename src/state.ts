import type { Browser, Page } from 'puppeteer';
import { getPuppeteer } from './puppeteer.js';
import type { ServerState, LogFunction } from './types.js';

export const DEFAULT_PAGE_ID = 'default';

const DEFAULT_LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

const STEALTH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Stealth shim. Passed to page.evaluateOnNewDocument as a real function so
 * puppeteer serialises it via .toString() and runs it in the browser context
 * — the previous string-wrapped version defined an arrow function value that
 * never executed.
 */
function installStealthShim() {
  const nav = (globalThis as any).navigator;
  const win = (globalThis as any).window;
  Object.defineProperty(nav, 'webdriver', { get: () => undefined, configurable: true });
  Object.defineProperty(nav, 'plugins', { get: () => [1, 2, 3, 4, 5], configurable: true });
  Object.defineProperty(nav, 'languages', { get: () => ['en-US', 'en'], configurable: true });
  win.chrome = { runtime: {} };
  Object.defineProperty(nav, 'permissions', {
    get: () => ({ query: () => Promise.resolve({ state: 'granted' }) }),
    configurable: true,
  });
}

export function createState(): ServerState {
  return {
    browser: null,
    pages: new Map(),
    currentViewport: null,
    currentUserAgent: null,
    currentStealth: false,
    pipeDisconnected: false,
    browserLaunching: null,
    pageCreations: new Map(),
  };
}

export function getPage(state: ServerState, pageId: string) {
  const page = state.pages.get(pageId);
  if (!page) {
    throw new Error(`Page ${pageId} not found`);
  }
  return page;
}

export function requireBrowser(state: ServerState) {
  if (!state.browser) {
    throw new Error('Browser not launched. Call puppeteer_launch first.');
  }
  return state.browser;
}

/**
 * Apply the session-level defaults captured at launch time (viewport,
 * userAgent, stealth shim) to a page. Used both for the initial blank tab and
 * any later pages — without this, lazy-created pages would skip the launch
 * options entirely.
 */
export async function applyPageDefaults(page: Page, state: ServerState): Promise<void> {
  if (state.currentViewport) {
    await page.setViewport(state.currentViewport);
  }
  if (state.currentUserAgent) {
    await page.setUserAgent(state.currentUserAgent);
  } else if (state.currentStealth) {
    await page.setUserAgent(STEALTH_UA);
  }
  if (state.currentStealth) {
    await page.evaluateOnNewDocument(installStealthShim);
  }
}

/**
 * Launch a browser with sane defaults if one isn't already running. Cached
 * in-flight Promise prevents two concurrent calls from each spawning their
 * own Chromium and leaking the loser.
 */
export async function ensureBrowser(state: ServerState, log: LogFunction): Promise<Browser> {
  if (state.browser) return state.browser;
  if (state.browserLaunching) return state.browserLaunching;

  log('Auto-launching browser with default options');
  const puppeteer = getPuppeteer();
  state.browserLaunching = (async () => {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: DEFAULT_LAUNCH_ARGS,
        defaultViewport: null,
      });
      state.browser = browser;
      return browser;
    } finally {
      state.browserLaunching = null;
    }
  })();
  return state.browserLaunching;
}

/**
 * Get a page, creating it on the fly if missing. Cached in-flight Promise
 * per pageId prevents two concurrent calls from each opening a tab and
 * leaking the loser.
 */
export async function ensurePage(
  state: ServerState,
  pageId: string,
  log: LogFunction
): Promise<Page> {
  const existing = state.pages.get(pageId);
  if (existing) return existing;

  const inflight = state.pageCreations.get(pageId);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const browser = await ensureBrowser(state, log);
      log(`Auto-creating page "${pageId}"`);
      const page = await browser.newPage();
      await applyPageDefaults(page, state);
      state.pages.set(pageId, page);
      return page;
    } finally {
      state.pageCreations.delete(pageId);
    }
  })();
  state.pageCreations.set(pageId, promise);
  return promise;
}
