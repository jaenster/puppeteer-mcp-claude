import { z, type ZodTypeAny } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  handleLaunch,
  handleNewPage,
  handleClosePage,
  handleNavigate,
  handleClick,
  handleType,
  handleGetText,
  handleScreenshot,
  handleEvaluate,
  handleWaitForSelector,
  handleSetCookies,
  handleGetCookies,
  handleDeleteCookies,
  handleSetRequestInterception,
  handleCloseBrowser,
} from './handlers/index.js';
import { DEFAULT_PAGE_ID, ensureBrowser, ensurePage } from './state.js';
import type { ServerState, LogFunction } from './types.js';

/**
 * Thin wrapper around McpServer.registerTool. The SDK's typings combine deep
 * Zod generics that overflow TypeScript's instantiation budget when many tools
 * are registered. Runtime Zod validation still applies — we just opt out of the
 * compile-time schema↔handler link and re-establish it with explicit handler
 * argument types.
 */
function tool<TArgs>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Record<string, ZodTypeAny>,
  handler: (args: TArgs) => Promise<unknown>
) {
  return (server.registerTool as any)(name, { description, inputSchema }, handler);
}

const viewportShape = z.object({
  width: z.number(),
  height: z.number(),
  deviceScaleFactor: z.number().optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
  isLandscape: z.boolean().optional(),
});

const proxyShape = z.object({
  server: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const cookieShape = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
});

const deleteCookieShape = z.object({
  name: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
});

const resourceTypeEnum = z.enum([
  'document',
  'stylesheet',
  'image',
  'media',
  'font',
  'script',
  'texttrack',
  'xhr',
  'fetch',
  'eventsource',
  'websocket',
  'manifest',
  'other',
]);

export function registerTools(
  server: McpServer,
  state: ServerState,
  log: LogFunction
) {
  tool<{
    headless?: boolean;
    args?: string[];
    executablePath?: string;
    browserWSEndpoint?: string;
    userDataDir?: string;
    userAgent?: string;
    viewport?: any;
    proxy?: any;
    stealth?: boolean;
    slowMo?: number;
  }>(
    server,
    'puppeteer_launch',
    'Launch a new Puppeteer browser instance or connect to existing Chrome with remote debugging. Optional — the server will auto-launch with defaults the first time you use any other tool.',
    {
      headless: z.boolean().optional(),
      args: z.array(z.string()).optional(),
      executablePath: z.string().optional(),
      browserWSEndpoint: z
        .string()
        .optional()
        .describe('WebSocket endpoint for an existing Chrome (e.g. ws://localhost:9222)'),
      userDataDir: z.string().optional(),
      userAgent: z.string().optional(),
      viewport: viewportShape.optional(),
      proxy: proxyShape.optional(),
      stealth: z.boolean().optional().describe('Enable anti-detection tweaks'),
      slowMo: z.number().optional(),
    },
    (args) => handleLaunch(args as any, state, log)
  );

  tool<{ pageId?: string }>(
    server,
    'puppeteer_new_page',
    'Create a new browser tab. If puppeteer_launch was not called, the browser auto-launches with defaults.',
    {
      pageId: z.string().optional(),
    },
    async (args) => {
      await ensureBrowser(state, log);
      return handleNewPage({ pageId: args.pageId ?? DEFAULT_PAGE_ID }, state);
    }
  );

  tool<{
    url: string;
    pageId?: string;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  }>(
    server,
    'puppeteer_navigate',
    'Navigate a tab to a URL.',
    {
      url: z.string(),
      pageId: z.string().optional(),
      waitUntil: z
        .enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
        .optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleNavigate({ ...args, pageId }, state);
    }
  );

  tool<{ selector: string; pageId?: string }>(
    server,
    'puppeteer_click',
    'Click an element matching the given CSS selector.',
    {
      selector: z.string(),
      pageId: z.string().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleClick({ ...args, pageId }, state);
    }
  );

  tool<{ selector: string; text: string; pageId?: string }>(
    server,
    'puppeteer_type',
    'Type text into an element matching the given CSS selector.',
    {
      selector: z.string(),
      text: z.string(),
      pageId: z.string().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleType({ ...args, pageId }, state);
    }
  );

  tool<{ selector: string; pageId?: string }>(
    server,
    'puppeteer_get_text',
    'Get the textContent of the first element matching the selector.',
    {
      selector: z.string(),
      pageId: z.string().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleGetText({ ...args, pageId }, state);
    }
  );

  tool<{ pageId?: string; path?: string; fullPage?: boolean }>(
    server,
    'puppeteer_screenshot',
    'Take a PNG screenshot. Returns the image inline so Claude can see it; optionally also saves to `path`.',
    {
      pageId: z.string().optional(),
      path: z.string().optional(),
      fullPage: z.boolean().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleScreenshot({ ...args, pageId }, state);
    }
  );

  tool<{ script: string; pageId?: string }>(
    server,
    'puppeteer_evaluate',
    'Run a JavaScript expression in the page context and return its JSON-serialised result.',
    {
      script: z.string(),
      pageId: z.string().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleEvaluate({ ...args, pageId }, state);
    }
  );

  tool<{ selector: string; pageId?: string; timeout?: number }>(
    server,
    'puppeteer_wait_for_selector',
    'Wait until an element matching the selector appears in the DOM.',
    {
      selector: z.string(),
      pageId: z.string().optional(),
      timeout: z.number().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleWaitForSelector({ ...args, pageId }, state);
    }
  );

  tool<{ pageId?: string }>(
    server,
    'puppeteer_close_page',
    'Close a specific tab.',
    {
      pageId: z.string().optional(),
    },
    (args) => handleClosePage({ pageId: args.pageId ?? DEFAULT_PAGE_ID }, state)
  );

  tool<Record<string, never>>(
    server,
    'puppeteer_close_browser',
    'Close the entire browser and all tabs.',
    {},
    () => handleCloseBrowser({}, state)
  );

  tool<{ cookies: any[]; pageId?: string }>(
    server,
    'puppeteer_set_cookies',
    'Set cookies on a tab.',
    {
      cookies: z.array(cookieShape),
      pageId: z.string().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleSetCookies({ ...args, pageId } as any, state);
    }
  );

  tool<{ pageId?: string; urls?: string[] }>(
    server,
    'puppeteer_get_cookies',
    'Get cookies from a tab.',
    {
      pageId: z.string().optional(),
      urls: z.array(z.string()).optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleGetCookies({ ...args, pageId }, state);
    }
  );

  tool<{ cookies: Array<{ name: string; domain?: string; path?: string }>; pageId?: string }>(
    server,
    'puppeteer_delete_cookies',
    'Delete cookies from a tab.',
    {
      cookies: z.array(deleteCookieShape),
      pageId: z.string().optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleDeleteCookies({ ...args, pageId }, state);
    }
  );

  tool<{
    pageId?: string;
    enable?: boolean;
    blockResources?: string[];
    modifyHeaders?: Record<string, string>;
  }>(
    server,
    'puppeteer_set_request_interception',
    'Enable request interception for a tab. Optionally block resources by type or inject headers.',
    {
      pageId: z.string().optional(),
      enable: z.boolean().optional(),
      blockResources: z.array(resourceTypeEnum).optional(),
      modifyHeaders: z.record(z.string(), z.string()).optional(),
    },
    async (args) => {
      const pageId = args.pageId ?? DEFAULT_PAGE_ID;
      await ensurePage(state, pageId, log);
      return handleSetRequestInterception({ ...args, pageId } as any, state);
    }
  );
}
