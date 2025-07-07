#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

class ConsoleClaudeTest {
  private httpServer: any;
  private claudeConfigPath: string;
  private originalConfig: any = null;

  constructor() {
    this.claudeConfigPath = join(homedir(), '.claude', 'claude_desktop_config.json');
  }

  async runConsoleTest(): Promise<void> {
    console.log('🚀 Running Console Claude Code + MCP Test...\n');
    
    try {
      await this.startTestServer();
      await this.setupMCPConfig();
      await this.runClaudeConsoleCommand();
      
      console.log('\n✅ Console Claude Code test completed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  private async startTestServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const htmlContent = readFileSync(join(__dirname, '../test-site/index.html'), 'utf8');
      
      this.httpServer = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
      });

      this.httpServer.listen(3004, () => {
        console.log('🌐 Test server started on http://localhost:3004');
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  private async setupMCPConfig(): Promise<void> {
    console.log('🔧 Setting up MCP configuration...');
    
    // Backup original config
    if (existsSync(this.claudeConfigPath)) {
      this.originalConfig = JSON.parse(readFileSync(this.claudeConfigPath, 'utf8'));
    }
    
    const config = {
      mcpServers: {
        puppeteer: {
          command: 'ts-node',
          args: ['src/index.ts'],
          cwd: process.cwd(),
          env: {
            NODE_ENV: 'test'
          }
        }
      }
    };

    writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ MCP configuration updated');
  }

  private async runClaudeConsoleCommand(): Promise<void> {
    console.log('🎯 Running Claude console command...');
    
    const prompt = `Use the MCP Puppeteer tools to:
1. Launch a browser
2. Create a new page with ID "console-test"
3. Navigate to http://localhost:3004
4. Fill out the form with name "Console Test" and email "console@test.com"
5. Submit the form
6. Take a screenshot called "console-test-screenshot.png"
7. Wait for the delayed element that appears after 2 seconds
8. Get the text from the result name field
9. Close the browser

Please execute these steps and tell me what you accomplished.`;

    return new Promise((resolve, reject) => {
      const claudeProcess = spawn('claude', [
        '--dangerously-skip-permissions',
        prompt
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        claudeProcess.kill();
        reject(new Error('Claude command timeout after 2 minutes'));
      }, 120000); // 2 minutes timeout

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log('Claude Output:', chunk);
      });

      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.log('Claude Error:', chunk);
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          console.log('✅ Claude command completed successfully');
          console.log('\n📄 Full Claude Response:');
          console.log(output);
          
          // Check if screenshot was created
          if (existsSync('console-test-screenshot.png')) {
            console.log('✅ Screenshot was created successfully');
          } else {
            console.log('⚠️  Screenshot not found, but command completed');
          }
          
          resolve();
        } else {
          console.log(`❌ Claude command failed with code ${code}`);
          console.log('Error output:', errorOutput);
          reject(new Error(`Claude command failed with code ${code}`));
        }
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    
    // Restore original config
    if (this.originalConfig) {
      writeFileSync(this.claudeConfigPath, JSON.stringify(this.originalConfig, null, 2));
      console.log('✅ Original configuration restored');
    }
    
    // Close test server
    if (this.httpServer) {
      this.httpServer.close();
      console.log('✅ Test server closed');
    }
    
    console.log('🧹 Cleanup completed');
  }
}

// Run the test
const test = new ConsoleClaudeTest();
test.runConsoleTest().catch(console.error);