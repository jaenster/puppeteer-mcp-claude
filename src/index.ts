#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { createState } from './state';
import { createLogger, initializeLogging } from './logging';
import { toolDefinitions } from './tools';
import type { ServerState, LogFunction } from './types';

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
} from './handlers/index';

class PuppeteerMCPServer {
  private server: Server;
  private state: ServerState;
  private log: LogFunction;

  constructor() {
    const logFile = initializeLogging();
    this.state = createState();
    this.log = createLogger(logFile, this.state);

    this.log('=== Puppeteer MCP Server Starting ===');
    this.log(`Process started at: ${new Date().toISOString()}`);
    this.log(`Process ID: ${process.pid}`);
    this.log(`Node version: ${process.version}`);
    this.log(`Working directory: ${process.cwd()}`);
    this.log(`Script location: ${__filename}`);
    this.log(`Arguments: ${JSON.stringify(process.argv)}`);
    this.log(`Environment PATH: ${process.env.PATH}`);
    this.log(`Log file: ${logFile}`);

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
    this.server.onerror = (error) => {
      this.log(`[MCP Error] ${error}`);
    };

    const handlePipeError = (stream: NodeJS.WriteStream, name: string) => {
      stream.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
          this.state.pipeDisconnected = true;
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
      if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
        this.state.pipeDisconnected = true;
        this.log('Client disconnected (EPIPE), shutting down gracefully');
        this.cleanup().then(() => process.exit(0));
        return;
      }
      this.log(`Uncaught Exception: ${error.stack}`);
    });

    process.on('unhandledRejection', (reason, promise) => {
      if (reason instanceof Error) {
        const errnoError = reason as NodeJS.ErrnoException;
        if (errnoError.code === 'EPIPE' || errnoError.code === 'ERR_STREAM_DESTROYED') {
          this.state.pipeDisconnected = true;
          this.log('Client disconnected (EPIPE in promise), shutting down gracefully');
          this.cleanup().then(() => process.exit(0));
          return;
        }
      }
      this.log(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    });
  }

  private async cleanup(): Promise<void> {
    if (this.state.browser) {
      await this.state.browser.close();
    }
  }

  private setupToolHandlers(): void {
    this.log('Setting up tool handlers...');

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.log('Received ListTools request');
      return { tools: toolDefinitions as Tool[] };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.log(`Received CallTool request: ${name} with args: ${JSON.stringify(args)}`);

      try {
        switch (name) {
          case 'puppeteer_launch':
            return await handleLaunch(args as any, this.state, this.log);
          case 'puppeteer_new_page':
            return await handleNewPage(args as any, this.state);
          case 'puppeteer_navigate':
            return await handleNavigate(args as any, this.state);
          case 'puppeteer_click':
            return await handleClick(args as any, this.state);
          case 'puppeteer_type':
            return await handleType(args as any, this.state);
          case 'puppeteer_get_text':
            return await handleGetText(args as any, this.state);
          case 'puppeteer_screenshot':
            return await handleScreenshot(args as any, this.state);
          case 'puppeteer_evaluate':
            return await handleEvaluate(args as any, this.state);
          case 'puppeteer_wait_for_selector':
            return await handleWaitForSelector(args as any, this.state);
          case 'puppeteer_close_page':
            return await handleClosePage(args as any, this.state);
          case 'puppeteer_close_browser':
            return await handleCloseBrowser(args as any, this.state);
          case 'puppeteer_set_cookies':
            return await handleSetCookies(args as any, this.state);
          case 'puppeteer_get_cookies':
            return await handleGetCookies(args as any, this.state);
          case 'puppeteer_delete_cookies':
            return await handleDeleteCookies(args as any, this.state);
          case 'puppeteer_set_request_interception':
            return await handleSetRequestInterception(args as any, this.state);
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
  console.error(`Fatal error: ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
