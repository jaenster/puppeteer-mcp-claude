#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer, { Browser, Page } from 'puppeteer';

class PuppeteerMCPServer {
  private server: Server;
  private browser: Browser | null = null;
  private pages: Map<string, Page> = new Map();

  constructor() {
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

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'puppeteer_launch',
            description: 'Launch a new Puppeteer browser instance',
            inputSchema: {
              type: 'object',
              properties: {
                headless: { type: 'boolean', default: true },
                args: { type: 'array', items: { type: 'string' } },
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
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

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
    const { headless = true, args: browserArgs = [] } = args;
    
    if (this.browser) {
      await this.browser.close();
    }

    this.browser = await puppeteer.launch({
      headless,
      args: [...browserArgs, '--no-sandbox', '--disable-setuid-sandbox'],
    });

    return {
      content: [
        {
          type: 'text',
          text: 'Browser launched successfully',
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

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Puppeteer server running on stdio');
  }
}

const server = new PuppeteerMCPServer();
server.run().catch(console.error);