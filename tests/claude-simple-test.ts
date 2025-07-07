#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Simplified Claude Code test that just verifies the MCP connection works
class SimpleClaudeTest {
  private httpServer: any;
  private claudeConfigPath: string;
  private originalConfig: any = null;

  constructor() {
    this.claudeConfigPath = join(homedir(), '.claude', 'claude_desktop_config.json');
  }

  async runTest(): Promise<void> {
    console.log('🧪 Running Simple Claude Code MCP Test...\n');
    
    try {
      await this.startTestServer();
      await this.setupMCPConfig();
      await this.testMCPConnection();
      await this.demonstrateUsage();
      
      console.log('\n✅ Simple Claude Code MCP test completed successfully!');
      console.log('\n🎉 Your MCP Puppeteer server is ready to use with Claude Code!');
      
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

      this.httpServer.listen(3002, () => {
        console.log('🌐 Test server started on http://localhost:3002');
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
    console.log('✅ MCP configuration created');
  }

  private async testMCPConnection(): Promise<void> {
    console.log('🔌 Testing MCP server connection...');
    
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('ts-node', ['src/index.ts'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let connected = false;
      const timeout = setTimeout(() => {
        if (!connected) {
          mcpProcess.kill();
          reject(new Error('MCP server connection timeout'));
        }
      }, 10000);

      mcpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP Puppeteer server running')) {
          connected = true;
          clearTimeout(timeout);
          mcpProcess.kill();
          console.log('✅ MCP server connection successful');
          resolve();
        }
      });

      mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async demonstrateUsage(): Promise<void> {
    console.log('\n📋 Usage Instructions:');
    console.log('\n1. Start Claude Code:');
    console.log('   claude --interactive');
    console.log('\n2. Try these commands in Claude Code:');
    console.log('   • "List all available tools"');
    console.log('   • "Use puppeteer to launch a browser and navigate to google.com"');
    console.log('   • "Use puppeteer to take a screenshot of the current page"');
    console.log('\n3. Test with local site:');
    console.log(`   • "Navigate to http://localhost:3002 and fill out the form"`);
    console.log('\n4. Advanced automation:');
    console.log('   • "Use puppeteer to automate a complex web workflow"');
    
    console.log('\n🛠️  Available Puppeteer Tools:');
    const tools = [
      'puppeteer_launch - Launch browser',
      'puppeteer_new_page - Create new page',
      'puppeteer_navigate - Navigate to URL',
      'puppeteer_click - Click elements',
      'puppeteer_type - Type text',
      'puppeteer_get_text - Extract text',
      'puppeteer_screenshot - Take screenshots',
      'puppeteer_evaluate - Execute JavaScript',
      'puppeteer_wait_for_selector - Wait for elements',
      'puppeteer_close_page - Close page',
      'puppeteer_close_browser - Close browser'
    ];
    
    tools.forEach(tool => console.log(`   • ${tool}`));
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
  }
}

// Run the test
const test = new SimpleClaudeTest();
test.runTest().catch(console.error);