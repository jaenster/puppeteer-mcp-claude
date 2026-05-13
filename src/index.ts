#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createState } from './state.js';
import { createLogger, initializeLogging } from './logging.js';
import { registerTools } from './tools.js';
import type { ServerState, LogFunction } from './types.js';

// Read version from package.json at runtime so it stays in sync with whatever
// `npm version` writes during release — no double-bookkeeping in source.
const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const PKG_VERSION = JSON.parse(readFileSync(pkgPath, 'utf-8')).version as string;

class PuppeteerMCPServer {
  private server: McpServer;
  private state: ServerState;
  private log: LogFunction;
  private shuttingDown = false;

  constructor() {
    const logFile = initializeLogging();
    this.state = createState();
    this.log = createLogger(logFile, this.state);

    this.log('=== Puppeteer MCP Server Starting ===');
    this.log(`Process started at: ${new Date().toISOString()}`);
    this.log(`Process ID: ${process.pid}`);
    this.log(`Node version: ${process.version}`);
    this.log(`Log file: ${logFile}`);

    this.server = new McpServer({
      name: 'puppeteer-mcp-claude',
      version: PKG_VERSION,
    });

    registerTools(this.server, this.state, this.log);
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.server.onerror = (error) => {
      this.log(`[MCP Error] ${error}`);
    };

    const handlePipeError = (stream: NodeJS.WriteStream, name: string) => {
      stream.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
          this.state.pipeDisconnected = true;
          this.log(`${name} pipe disconnected, shutting down gracefully`);
          this.shutdown(0);
        }
      });
    };
    handlePipeError(process.stdout, 'stdout');
    handlePipeError(process.stderr, 'stderr');

    const onSignal = (sig: NodeJS.Signals) => {
      this.log(`Received ${sig}, cleaning up...`);
      this.shutdown(0);
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
        this.state.pipeDisconnected = true;
        this.log('Client disconnected (EPIPE), shutting down gracefully');
        this.shutdown(0);
        return;
      }
      this.log(`Uncaught Exception: ${error.stack ?? inspect(error)}`);
    });

    process.on('unhandledRejection', (reason) => {
      if (reason instanceof Error) {
        const errnoError = reason as NodeJS.ErrnoException;
        if (errnoError.code === 'EPIPE' || errnoError.code === 'ERR_STREAM_DESTROYED') {
          this.state.pipeDisconnected = true;
          this.log('Client disconnected (EPIPE in promise), shutting down gracefully');
          this.shutdown(0);
          return;
        }
      }
      this.log(`Unhandled Rejection: ${reason instanceof Error ? reason.stack : inspect(reason)}`);
    });
  }

  private shutdown(code: number): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.cleanup()
      .catch((err) => this.log(`Cleanup error: ${inspect(err)}`))
      .finally(() => process.exit(code));
  }

  private async cleanup(): Promise<void> {
    if (this.state.browser) {
      const browser = this.state.browser;
      this.state.browser = null;
      try {
        await browser.close();
      } catch {
        // ignore; we're shutting down anyway
      }
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log('Puppeteer MCP server running on stdio');
  }
}

const server = new PuppeteerMCPServer();
server.run().catch((error) => {
  console.error(`Fatal error: ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
