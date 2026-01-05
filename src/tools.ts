/**
 * MCP Tool definitions for Puppeteer
 */
export const toolDefinitions = [
  {
    name: 'puppeteer_launch',
    description:
      'Launch a new Puppeteer browser instance or connect to existing Chrome with remote debugging',
    inputSchema: {
      type: 'object',
      properties: {
        headless: { type: 'boolean', default: true },
        args: { type: 'array', items: { type: 'string' } },
        executablePath: { type: 'string', description: 'Path to Chrome executable' },
        browserWSEndpoint: {
          type: 'string',
          description: 'WebSocket endpoint for existing Chrome instance (e.g., ws://localhost:9222)',
        },
        userDataDir: { type: 'string', description: 'Path to user data directory' },
        userAgent: { type: 'string', description: 'Custom user agent string' },
        viewport: {
          type: 'object',
          properties: {
            width: { type: 'number', default: 1366 },
            height: { type: 'number', default: 768 },
            deviceScaleFactor: { type: 'number', default: 1 },
            isMobile: { type: 'boolean', default: false },
            hasTouch: { type: 'boolean', default: false },
            isLandscape: { type: 'boolean', default: true },
          },
        },
        proxy: {
          type: 'object',
          properties: {
            server: { type: 'string' },
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
        stealth: {
          type: 'boolean',
          default: false,
          description: 'Enable stealth mode to avoid detection',
        },
        slowMo: { type: 'number', description: 'Delay between actions in milliseconds' },
      },
    },
  },
  {
    name: 'puppeteer_new_page',
    description: 'Create a new page in the browser',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Unique identifier for the page' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'puppeteer_navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        url: { type: 'string' },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
        },
      },
      required: ['pageId', 'url'],
    },
  },
  {
    name: 'puppeteer_click',
    description: 'Click on an element',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
      },
      required: ['pageId', 'selector'],
    },
  },
  {
    name: 'puppeteer_type',
    description: 'Type text into an element',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['pageId', 'selector', 'text'],
    },
  },
  {
    name: 'puppeteer_get_text',
    description: 'Get text content from an element',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
      },
      required: ['pageId', 'selector'],
    },
  },
  {
    name: 'puppeteer_screenshot',
    description: 'Take a screenshot of the page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        path: { type: 'string' },
        fullPage: { type: 'boolean', default: false },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'puppeteer_evaluate',
    description: 'Execute JavaScript in the page context',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        script: { type: 'string' },
      },
      required: ['pageId', 'script'],
    },
  },
  {
    name: 'puppeteer_wait_for_selector',
    description: 'Wait for a selector to appear',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        selector: { type: 'string' },
        timeout: { type: 'number', default: 30000 },
      },
      required: ['pageId', 'selector'],
    },
  },
  {
    name: 'puppeteer_close_page',
    description: 'Close a specific page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'puppeteer_close_browser',
    description: 'Close the browser and all pages',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'puppeteer_set_cookies',
    description: 'Set cookies for a page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        cookies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
              domain: { type: 'string' },
              path: { type: 'string', default: '/' },
              expires: { type: 'number' },
              httpOnly: { type: 'boolean', default: false },
              secure: { type: 'boolean', default: false },
              sameSite: { type: 'string', enum: ['Strict', 'Lax', 'None'] },
            },
            required: ['name', 'value'],
          },
        },
      },
      required: ['pageId', 'cookies'],
    },
  },
  {
    name: 'puppeteer_get_cookies',
    description: 'Get cookies from a page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        urls: { type: 'array', items: { type: 'string' } },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'puppeteer_delete_cookies',
    description: 'Delete cookies from a page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        cookies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              domain: { type: 'string' },
              path: { type: 'string' },
            },
            required: ['name'],
          },
        },
      },
      required: ['pageId', 'cookies'],
    },
  },
  {
    name: 'puppeteer_set_request_interception',
    description: 'Enable request/response interception for a page',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        enable: { type: 'boolean', default: true },
        blockResources: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
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
            ],
          },
          description: 'Resource types to block',
        },
        modifyHeaders: {
          type: 'object',
          description: 'Headers to add/modify in requests',
        },
      },
      required: ['pageId'],
    },
  },
];
