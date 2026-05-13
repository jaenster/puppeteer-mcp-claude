import type { Browser, Page, Viewport, CookieParam } from 'puppeteer';

/**
 * Shared state for the MCP server
 */
export interface ServerState {
  browser: Browser | null;
  pages: Map<string, Page>;
  currentViewport: Viewport | null;
  currentUserAgent: string | null;
  currentStealth: boolean;
  pipeDisconnected: boolean;
  /** In-flight launch promise; ensures concurrent ensureBrowser() calls share one Chromium. */
  browserLaunching: Promise<Browser> | null;
  /** In-flight page-creation promises keyed by pageId. */
  pageCreations: Map<string, Promise<Page>>;
}

/**
 * MCP response format - uses index signature for SDK compatibility
 */
export type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export interface MCPResponse {
  content: MCPContent[];
  structuredContent?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Logging function type
 */
export type LogFunction = (message: string) => void;

// Handler argument types
export interface LaunchArgs {
  headless?: boolean;
  args?: string[];
  executablePath?: string;
  browserWSEndpoint?: string;
  userDataDir?: string;
  userAgent?: string;
  viewport?: Viewport;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  stealth?: boolean;
  slowMo?: number;
}

export interface PageIdArgs {
  pageId: string;
}

export interface NavigateArgs extends PageIdArgs {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

export interface SelectorArgs extends PageIdArgs {
  selector: string;
}

export interface TypeArgs extends SelectorArgs {
  text: string;
}

export interface ScreenshotArgs extends PageIdArgs {
  path?: string;
  fullPage?: boolean;
}

export interface EvaluateArgs extends PageIdArgs {
  script: string;
}

export interface WaitForSelectorArgs extends SelectorArgs {
  timeout?: number;
}

export interface SetCookiesArgs extends PageIdArgs {
  cookies: CookieParam[];
}

export interface GetCookiesArgs extends PageIdArgs {
  urls?: string[];
}

export interface DeleteCookiesArgs extends PageIdArgs {
  cookies: Array<{
    name: string;
    domain?: string;
    path?: string;
  }>;
}

export type ResourceType =
  | 'document'
  | 'stylesheet'
  | 'image'
  | 'media'
  | 'font'
  | 'script'
  | 'texttrack'
  | 'xhr'
  | 'fetch'
  | 'eventsource'
  | 'websocket'
  | 'manifest'
  | 'other';

export interface SetRequestInterceptionArgs extends PageIdArgs {
  enable?: boolean;
  blockResources?: ResourceType[];
  modifyHeaders?: Record<string, string>;
}
