import { vi } from 'vitest';
import type { ServerState } from '../../../src/types';
import type { Page, Browser } from 'puppeteer';
import { createMockBrowser, createMockPage } from './puppeteer.mock';

export interface MockStateOptions {
  browser?: Browser | null;
  pages?: Map<string, Page>;
  pipeDisconnected?: boolean;
}

/**
 * Create a mock server state for testing
 */
export function createMockState(options: MockStateOptions = {}): ServerState {
  return {
    browser: options.browser ?? null,
    pages: options.pages ?? new Map(),
    currentViewport: null,
    pipeDisconnected: options.pipeDisconnected ?? false,
  };
}

/**
 * Create a mock state with a browser and optionally pages
 */
export function createMockStateWithBrowser(
  pageEntries: Array<[string, Page]> = []
): ServerState {
  const state = createMockState({
    browser: createMockBrowser(),
    pages: new Map(pageEntries),
  });
  return state;
}

/**
 * Create a mock log function
 */
export function createMockLog() {
  return vi.fn();
}
