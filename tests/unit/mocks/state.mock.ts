import { mock } from 'node:test';
import type { Browser, Page } from 'puppeteer';
import type { ServerState } from '../../../src/types';
import { createMockBrowser } from './puppeteer.mock';

export interface MockStateOptions {
  browser?: Browser | null;
  pages?: Map<string, Page>;
  pipeDisconnected?: boolean;
}

export function createMockState(options: MockStateOptions = {}): ServerState {
  return {
    browser: options.browser ?? null,
    pages: options.pages ?? new Map(),
    currentViewport: null,
    currentUserAgent: null,
    currentStealth: false,
    pipeDisconnected: options.pipeDisconnected ?? false,
    browserLaunching: null,
    pageCreations: new Map(),
  };
}

export function createMockStateWithBrowser(
  pageEntries: Array<[string, Page]> = []
): ServerState {
  return createMockState({
    browser: createMockBrowser(),
    pages: new Map(pageEntries),
  });
}

export function createMockLog() {
  return mock.fn((_msg: string) => undefined);
}
