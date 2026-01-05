#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

class PuppeteerMCPServer {
  private server: Server;
  private browser: Browser | null = null;
  private pages: Map<string, Page> = new Map();
  private logFile: string;
  private currentViewport: any = null;
  private pipeDisconnected: boolean = false;

  constructor() {
    // Set up logging
    const logDir = path.join(os.homedir(), '.puppeteer-mcp-logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFile = path.join(logDir, `mcp-server-${Date.now()}.log`);
    
    this.log('=== Puppeteer MCP Server Starting ===');
    this.log(`Process started at: ${new Date().toISOString()}`);
    this.log(`Process ID: ${process.pid}`);
    this.log(`Node version: ${process.version}`);
    this.log(`Working directory: ${process.cwd()}`);
    this.log(`Script location: ${__filename}`);
    this.log(`Arguments: ${JSON.stringify(process.argv)}`);
    this.log(`Environment PATH: ${process.env.PATH}`);
    this.log(`Log file: ${this.logFile}`);
    
    this.server = new Server(
      {
        name: 'mcp-puppeteer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logMessage);
    // Only write to stderr if the pipe is still connected
    // This prevents infinite EPIPE error loops when Claude disconnects
    if (!this.pipeDisconnected) {
      try {
        console.error(logMessage.trim());
      } catch {
        // If writing to stderr fails, mark pipe as disconnected
        this.pipeDisconnected = true;
      }
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      this.log(`[MCP Error] ${error}`);
    };

    // Handle broken pipe errors on stdout/stderr - this happens when Claude disconnects
    const handlePipeError = (stream: NodeJS.WriteStream, name: string) => {
      stream.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
          this.pipeDisconnected = true;
          this.log(`${name} pipe disconnected, shutting down gracefully`);
          this.cleanup().then(() => process.exit(0));
        }
      });
    };
    handlePipeError(process.stdout, 'stdout');
    handlePipeError(process.stderr, 'stderr');

    process.on('SIGINT', async () => {
      this.log('Received SIGINT, cleaning up...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
      // Handle EPIPE errors gracefully - this means the client disconnected
      if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
        this.pipeDisconnected = true;
        this.log('Client disconnected (EPIPE), shutting down gracefully');
        this.cleanup().then(() => process.exit(0));
        return;
      }
      this.log(`Uncaught Exception: ${error.stack}`);
    });

    process.on('unhandledRejection', (reason, promise) => {
      // Check if it's an EPIPE-related rejection
      if (reason instanceof Error) {
        const errnoError = reason as NodeJS.ErrnoException;
        if (errnoError.code === 'EPIPE' || errnoError.code === 'ERR_STREAM_DESTROYED') {
          this.pipeDisconnected = true;
          this.log('Client disconnected (EPIPE in promise), shutting down gracefully');
          this.cleanup().then(() => process.exit(0));
          return;
        }
      }
      this.log(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    });
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private setupToolHandlers(): void {
    this.log('Setting up tool handlers...');
    
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.log('Received ListTools request');
      return {
        tools: [
          {
            name: 'puppeteer_launch',
            description: 'Launch a new Puppeteer browser instance or connect to existing Chrome with remote debugging',
            inputSchema: {
              type: 'object',
              properties: {
                headless: { type: 'boolean', default: true },
                args: { type: 'array', items: { type: 'string' } },
                executablePath: { type: 'string', description: 'Path to Chrome executable' },
                browserWSEndpoint: { type: 'string', description: 'WebSocket endpoint for existing Chrome instance (e.g., ws://localhost:9222)' },
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
                    isLandscape: { type: 'boolean', default: true }
                  }
                },
                proxy: {
                  type: 'object',
                  properties: {
                    server: { type: 'string' },
                    username: { type: 'string' },
                    password: { type: 'string' }
                  }
                },
                stealth: { type: 'boolean', default: false, description: 'Enable stealth mode to avoid detection' },
                slowMo: { type: 'number', description: 'Delay between actions in milliseconds' }
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
                waitUntil: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'] },
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
                      sameSite: { type: 'string', enum: ['Strict', 'Lax', 'None'] }
                    },
                    required: ['name', 'value']
                  }
                }
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
                urls: { type: 'array', items: { type: 'string' } }
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
                      path: { type: 'string' }
                    },
                    required: ['name']
                  }
                }
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
                  items: { type: 'string', enum: ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'texttrack', 'xhr', 'fetch', 'eventsource', 'websocket', 'manifest', 'other'] },
                  description: 'Resource types to block'
                },
                modifyHeaders: {
                  type: 'object',
                  description: 'Headers to add/modify in requests'
                }
              },
              required: ['pageId'],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.log(`Received CallTool request: ${name} with args: ${JSON.stringify(args)}`);

      try {
        switch (name) {
          case 'puppeteer_launch':
            return await this.handleLaunch(args);
          case 'puppeteer_new_page':
            return await this.handleNewPage(args);
          case 'puppeteer_navigate':
            return await this.handleNavigate(args);
          case 'puppeteer_click':
            return await this.handleClick(args);
          case 'puppeteer_type':
            return await this.handleType(args);
          case 'puppeteer_get_text':
            return await this.handleGetText(args);
          case 'puppeteer_screenshot':
            return await this.handleScreenshot(args);
          case 'puppeteer_evaluate':
            return await this.handleEvaluate(args);
          case 'puppeteer_wait_for_selector':
            return await this.handleWaitForSelector(args);
          case 'puppeteer_close_page':
            return await this.handleClosePage(args);
          case 'puppeteer_close_browser':
            return await this.handleCloseBrowser(args);
          case 'puppeteer_set_cookies':
            return await this.handleSetCookies(args);
          case 'puppeteer_get_cookies':
            return await this.handleGetCookies(args);
          case 'puppeteer_delete_cookies':
            return await this.handleDeleteCookies(args);
          case 'puppeteer_set_request_interception':
            return await this.handleSetRequestInterception(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async handleLaunch(args: any) {
    const { 
      headless = true, 
      args: browserArgs = [], 
      executablePath,
      browserWSEndpoint,
      userDataDir,
      userAgent,
      viewport,
      proxy,
      stealth = false,
      slowMo
    } = args;
    
    if (this.browser) {
      await this.browser.close();
    }

    // Store viewport for later use in new pages
    this.currentViewport = viewport || null;

    let launchOptions: any = {
      headless,
      slowMo,
      args: [...browserArgs, '--no-sandbox', '--disable-setuid-sandbox'],
      // Set defaultViewport to apply to all new pages
      // null = disable device emulation, use actual window size
      defaultViewport: viewport || null,
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    if (userDataDir) {
      launchOptions.userDataDir = userDataDir;
    }

    if (stealth) {
      launchOptions.args.push(
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=site-per-process',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking'
      );
    }

    if (proxy?.server) {
      launchOptions.args.push(`--proxy-server=${proxy.server}`);
    }

    if (browserWSEndpoint) {
      this.browser = await puppeteer.connect({
        browserWSEndpoint,
        // Disable default viewport when connecting to existing browser
        defaultViewport: viewport || null,
      });
    } else {
      this.browser = await puppeteer.launch(launchOptions);
    }

    if (viewport || userAgent || stealth) {
      const pages = await this.browser.pages();
      if (pages.length > 0) {
        const page = pages[0];
        
        if (viewport) {
          await page.setViewport(viewport);
        }
        
        if (userAgent) {
          await page.setUserAgent(userAgent);
        } else if (stealth) {
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        }

        if (stealth) {
          await page.evaluateOnNewDocument(`() => {
            Object.defineProperty(navigator, 'webdriver', { 
              get: () => undefined,
              configurable: true 
            });
            Object.defineProperty(navigator, 'plugins', { 
              get: () => [1, 2, 3, 4, 5],
              configurable: true 
            });
            Object.defineProperty(navigator, 'languages', { 
              get: () => ['en-US', 'en'],
              configurable: true 
            });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'permissions', {
              get: () => ({
                query: () => Promise.resolve({ state: 'granted' })
              }),
              configurable: true
            });
          }`);
        }
      }
    }

    const connectionMethod = browserWSEndpoint ? 'Connected to existing browser' : 'Browser launched';
    return {
      content: [
        {
          type: 'text',
          text: `${connectionMethod} successfully`,
        },
      ],
    };
  }

  private async handleNewPage(args: any) {
    const { pageId } = args;

    if (!this.browser) {
      throw new Error('Browser not launched. Call puppeteer_launch first.');
    }

    const page = await this.browser.newPage();

    // Apply stored viewport to new page (as additional safeguard)
    if (this.currentViewport) {
      await page.setViewport(this.currentViewport);
    }

    this.pages.set(pageId, page);

    return {
      content: [
        {
          type: 'text',
          text: `Page ${pageId} created successfully`,
        },
      ],
    };
  }

  private async handleNavigate(args: any) {
    const { pageId, url, waitUntil = 'load' } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.goto(url, { waitUntil });

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to ${url}`,
        },
      ],
    };
  }

  private async handleClick(args: any) {
    const { pageId, selector } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.click(selector);

    return {
      content: [
        {
          type: 'text',
          text: `Clicked on ${selector}`,
        },
      ],
    };
  }

  private async handleType(args: any) {
    const { pageId, selector, text } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.type(selector, text);

    return {
      content: [
        {
          type: 'text',
          text: `Typed "${text}" into ${selector}`,
        },
      ],
    };
  }

  private async handleGetText(args: any) {
    const { pageId, selector } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element ${selector} not found`);
    }

    const text = await page.evaluate((el) => el.textContent, element);

    return {
      content: [
        {
          type: 'text',
          text: `Text from ${selector}: ${text}`,
        },
      ],
    };
  }

  private async handleScreenshot(args: any) {
    const { pageId, path, fullPage = false } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    const screenshot = await page.screenshot({ 
      path, 
      fullPage,
      type: 'png'
    });

    return {
      content: [
        {
          type: 'text',
          text: path ? `Screenshot saved to ${path}` : 'Screenshot taken',
        },
      ],
    };
  }

  private async handleEvaluate(args: any) {
    const { pageId, script } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    const result = await page.evaluate(script);

    return {
      content: [
        {
          type: 'text',
          text: `Script result: ${JSON.stringify(result)}`,
        },
      ],
    };
  }

  private async handleWaitForSelector(args: any) {
    const { pageId, selector, timeout = 30000 } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.waitForSelector(selector, { timeout });

    return {
      content: [
        {
          type: 'text',
          text: `Selector ${selector} appeared`,
        },
      ],
    };
  }

  private async handleClosePage(args: any) {
    const { pageId } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.close();
    this.pages.delete(pageId);

    return {
      content: [
        {
          type: 'text',
          text: `Page ${pageId} closed`,
        },
      ],
    };
  }

  private async handleCloseBrowser(args: any) {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.pages.clear();
    }

    return {
      content: [
        {
          type: 'text',
          text: 'Browser closed',
        },
      ],
    };
  }

  private async handleSetCookies(args: any) {
    const { pageId, cookies } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.setCookie(...cookies);

    return {
      content: [
        {
          type: 'text',
          text: `Set ${cookies.length} cookie(s) for page ${pageId}`,
        },
      ],
    };
  }

  private async handleGetCookies(args: any) {
    const { pageId, urls } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    const cookies = urls ? await page.cookies(...urls) : await page.cookies();

    return {
      content: [
        {
          type: 'text',
          text: `Retrieved cookies: ${JSON.stringify(cookies, null, 2)}`,
        },
      ],
    };
  }

  private async handleDeleteCookies(args: any) {
    const { pageId, cookies } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.deleteCookie(...cookies);

    return {
      content: [
        {
          type: 'text',
          text: `Deleted ${cookies.length} cookie(s) from page ${pageId}`,
        },
      ],
    };
  }

  private async handleSetRequestInterception(args: any) {
    const { pageId, enable = true, blockResources = [], modifyHeaders = {} } = args;
    const page = this.pages.get(pageId);
    
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }

    await page.setRequestInterception(enable);

    if (enable) {
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        
        if (blockResources.includes(resourceType)) {
          request.abort();
          return;
        }

        const headers = { ...request.headers(), ...modifyHeaders };
        request.continue({ headers });
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: `Request interception ${enable ? 'enabled' : 'disabled'} for page ${pageId}`,
        },
      ],
    };
  }

  async run(): Promise<void> {
    this.log('Starting MCP server...');
    try {
      const transport = new StdioServerTransport();
      this.log('Created StdioServerTransport');

      await this.server.connect(transport);
      this.log('Successfully connected to transport');
      this.log('MCP Puppeteer server running on stdio');
      this.log('Server is now running and ready to receive requests');
    } catch (error) {
      this.log(`Failed to start server: ${error}`);
      throw error;
    }
  }
}

const server = new PuppeteerMCPServer();
server.run().catch((error) => {
  server['log'](`Fatal error: ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});