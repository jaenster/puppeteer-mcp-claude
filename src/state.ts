import type { ServerState } from './types';

/**
 * Create initial server state
 */
export function createState(): ServerState {
  return {
    browser: null,
    pages: new Map(),
    currentViewport: null,
    pipeDisconnected: false,
  };
}

/**
 * Get a page by ID, throwing if not found
 */
export function getPage(state: ServerState, pageId: string) {
  const page = state.pages.get(pageId);
  if (!page) {
    throw new Error(`Page ${pageId} not found`);
  }
  return page;
}

/**
 * Ensure browser is launched, throwing if not
 */
export function requireBrowser(state: ServerState) {
  if (!state.browser) {
    throw new Error('Browser not launched. Call puppeteer_launch first.');
  }
  return state.browser;
}
