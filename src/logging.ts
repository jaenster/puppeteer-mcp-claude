import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ServerState, LogFunction } from './types';

/**
 * Create a logger that writes to both file and stderr
 */
export function createLogger(logFile: string, state: ServerState): LogFunction {
  return (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);

    // Only write to stderr if the pipe is still connected
    if (!state.pipeDisconnected) {
      try {
        console.error(logMessage.trim());
      } catch {
        state.pipeDisconnected = true;
      }
    }
  };
}

/**
 * Initialize logging directory and return log file path
 */
export function initializeLogging(): string {
  const logDir = path.join(os.homedir(), '.puppeteer-mcp-logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, `mcp-server-${Date.now()}.log`);
}
