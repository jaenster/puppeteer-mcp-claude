#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

class RealClaudeTest {
  private httpServer: any;
  private claudeConfigPath: string;
  private originalConfig: any = null;

  constructor() {
    this.claudeConfigPath = join(homedir(), '.claude', 'claude_desktop_config.json');
  }

  async runRealTest(): Promise<void> {
    console.log('🚀 Running Real Claude Code + MCP Integration Test...\n');
    
    try {
      await this.startTestServer();
      await this.setupMCPConfig();
      await this.testMCPServerDirectly();
      await this.runAutomatedClaudeTest();
      
      console.log('\n✅ Real Claude Code integration test completed!');
      
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

      this.httpServer.listen(3003, () => {
        console.log('🌐 Test server started on http://localhost:3003');
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

  private async testMCPServerDirectly(): Promise<void> {
    console.log('🔌 Testing MCP server directly...');
    
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('ts-node', ['src/index.ts'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let serverReady = false;
      const timeout = setTimeout(() => {
        if (!serverReady) {
          mcpProcess.kill();
          reject(new Error('MCP server startup timeout'));
        }
      }, 10000);

      mcpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP Puppeteer server running')) {
          serverReady = true;
          clearTimeout(timeout);
          
          // Test basic MCP protocol
          this.testMCPProtocol(mcpProcess).then(() => {
            mcpProcess.kill();
            console.log('✅ MCP server test successful');
            resolve();
          }).catch(reject);
        }
      });

      mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async testMCPProtocol(mcpProcess: any): Promise<void> {
    return new Promise((resolve, reject) => {
      let responseReceived = false;
      
      // Test list tools
      const listToolsCommand = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      mcpProcess.stdout.on('data', (data: Buffer) => {
        const response = data.toString();
        try {
          const parsed = JSON.parse(response);
          if (parsed.result && parsed.result.tools && parsed.result.tools.length > 0) {
            console.log(`✅ Found ${parsed.result.tools.length} Puppeteer tools`);
            responseReceived = true;
            resolve();
          }
        } catch (e) {
          // Continue waiting
        }
      });

      mcpProcess.stdin.write(JSON.stringify(listToolsCommand) + '\n');
      
      setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('No response from MCP server'));
        }
      }, 5000);
    });
  }

  private async runAutomatedClaudeTest(): Promise<void> {
    console.log('\n🧪 Running Automated Claude Code MCP Tests...');
    
    return new Promise((resolve, reject) => {
      // First start the MCP server
      const mcpProcess = spawn('ts-node', ['src/index.ts'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let serverReady = false;
      const timeout = setTimeout(() => {
        if (!serverReady) {
          mcpProcess.kill();
          reject(new Error('MCP server startup timeout'));
        }
      }, 15000);

      mcpProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('MCP Puppeteer server running')) {
          serverReady = true;
          clearTimeout(timeout);
          
          // Now start Claude with MCP configuration
          this.runClaudeWithMCP(mcpProcess).then(() => {
            mcpProcess.kill();
            console.log('✅ Claude MCP integration test completed successfully');
            resolve();
          }).catch(reject);
        }
      });

      mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async runClaudeWithMCP(mcpProcess: any): Promise<void> {
    console.log('\n🤖 Starting Claude with MCP configuration...');
    
    return new Promise((resolve, reject) => {
      // First configure MCP server
      const mcpConfigProcess = spawn('claude', ['mcp', 'mcp-puppeteer', 'ts-node', 'src/index.ts'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env }
      });

      let mcpConfigured = false;
      const configTimeout = setTimeout(() => {
        if (!mcpConfigured) {
          mcpConfigProcess.kill();
          reject(new Error('MCP configuration timeout'));
        }
      }, 10000);

      mcpConfigProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('MCP Config Output:', output);
        if (output.includes('configured') || output.includes('success')) {
          mcpConfigured = true;
          clearTimeout(configTimeout);
          mcpConfigProcess.kill();
          
          // Now run Claude with actual commands
          this.runClaudeCommands().then(resolve).catch(reject);
        }
      });

      mcpConfigProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('MCP Config Error:', output);
        if (output.includes('configured') || output.includes('success')) {
          mcpConfigured = true;
          clearTimeout(configTimeout);
          mcpConfigProcess.kill();
          
          // Now run Claude with actual commands
          this.runClaudeCommands().then(resolve).catch(reject);
        }
      });

      mcpConfigProcess.on('error', (error) => {
        clearTimeout(configTimeout);
        reject(error);
      });
    });
  }

  private async runClaudeCommands(): Promise<void> {
    console.log('\n🎯 Running Claude commands with MCP tools...');
    
    return new Promise((resolve, reject) => {
      const claudeProcess = spawn('claude', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env }
      });

      let commandsExecuted = 0;
      const expectedCommands = 3;
      let currentOutput = '';

      const timeout = setTimeout(() => {
        claudeProcess.kill();
        reject(new Error('Claude command execution timeout'));
      }, 60000); // 60 seconds timeout

      claudeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        currentOutput += output;
        console.log('Claude Output:', output);
        
        // Check for completion indicators
        if (output.includes('✅') || output.includes('completed') || output.includes('done')) {
          commandsExecuted++;
          if (commandsExecuted >= expectedCommands) {
            clearTimeout(timeout);
            claudeProcess.kill();
            resolve();
          }
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('Claude Error:', output);
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Send commands to Claude
      setTimeout(() => {
        console.log('📝 Sending command 1: Launch browser and navigate to test page');
        claudeProcess.stdin.write('Use the puppeteer tools to launch a browser, create a new page, and navigate to http://localhost:3003\n');
      }, 2000);

      setTimeout(() => {
        console.log('📝 Sending command 2: Fill form and submit');
        claudeProcess.stdin.write('Fill out the form on the page with name "Test User" and email "test@example.com", then submit it\n');
      }, 15000);

      setTimeout(() => {
        console.log('📝 Sending command 3: Take screenshot and close');
        claudeProcess.stdin.write('Take a screenshot of the page and then close the browser\n');
      }, 30000);

      setTimeout(() => {
        console.log('📝 Sending exit command');
        claudeProcess.stdin.write('exit\n');
      }, 45000);
    });
  }

  private async runFullAutomatedTests(mcpProcess: any): Promise<void> {
    const testResults: string[] = [];
    
    console.log('\n🔧 Test 1: Launch browser...');
    const launchResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'puppeteer_launch',
        arguments: { headless: true }
      }
    });
    
    if (launchResult.result) {
      testResults.push('✅ Browser launch successful');
      console.log('✅ Browser launched');
    } else {
      throw new Error('Browser launch failed');
    }

    console.log('\n🔧 Test 2: Create new page...');
    const pageResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'puppeteer_new_page',
        arguments: { pageId: 'test-page' }
      }
    });
    
    if (pageResult.result) {
      testResults.push('✅ Page creation successful');
      console.log('✅ Page created');
    } else {
      throw new Error('Page creation failed');
    }

    console.log('\n🔧 Test 3: Navigate to test site...');
    const navResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'puppeteer_navigate',
        arguments: { 
          pageId: 'test-page',
          url: 'http://localhost:3003'
        }
      }
    });
    
    if (navResult.result) {
      testResults.push('✅ Navigation successful');
      console.log('✅ Navigation completed');
    } else {
      throw new Error('Navigation failed');
    }

    console.log('\n🔧 Test 4: Fill form...');
    await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'puppeteer_type',
        arguments: {
          pageId: 'test-page',
          selector: '#name',
          text: 'Automated Test'
        }
      }
    });

    await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'puppeteer_type',
        arguments: {
          pageId: 'test-page',
          selector: '#email',
          text: 'test@automated.com'
        }
      }
    });

    const submitResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'puppeteer_click',
        arguments: {
          pageId: 'test-page',
          selector: 'button[type="submit"]'
        }
      }
    });

    if (submitResult.result) {
      testResults.push('✅ Form submission successful');
      console.log('✅ Form submitted');
    }

    console.log('\n🔧 Test 5: Wait for dynamic content...');
    const waitResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'puppeteer_wait_for_selector',
        arguments: {
          pageId: 'test-page',
          selector: '#delayed-element',
          timeout: 5000
        }
      }
    });

    if (waitResult.result) {
      testResults.push('✅ Dynamic content wait successful');
      console.log('✅ Dynamic content loaded');
    }

    console.log('\n🔧 Test 6: Take screenshot...');
    const screenshotResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'puppeteer_screenshot',
        arguments: {
          pageId: 'test-page',
          path: 'automated-test-screenshot.png'
        }
      }
    });

    if (screenshotResult.result) {
      testResults.push('✅ Screenshot capture successful');
      console.log('✅ Screenshot captured');
    }

    console.log('\n🔧 Test 7: Execute JavaScript...');
    const evalResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'puppeteer_evaluate',
        arguments: {
          pageId: 'test-page',
          script: 'document.title'
        }
      }
    });

    if (evalResult.result) {
      testResults.push('✅ JavaScript execution successful');
      console.log('✅ JavaScript executed');
    }

    console.log('\n🔧 Test 8: Close browser...');
    const closeResult = await this.sendMCPCommand(mcpProcess, {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'puppeteer_close_browser',
        arguments: {}
      }
    });

    if (closeResult.result) {
      testResults.push('✅ Browser close successful');
      console.log('✅ Browser closed');
    }

    console.log('\n📊 Test Results Summary:');
    testResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result}`);
    });

    console.log(`\n🎉 All ${testResults.length} tests passed!`);
  }

  private async sendMCPCommand(mcpProcess: any, command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let response = '';
      let responseReceived = false;

      const timeout = setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('MCP command timeout'));
        }
      }, 10000);

      const dataHandler = (data: Buffer) => {
        response += data.toString();
        try {
          const lines = response.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              const jsonResponse = JSON.parse(line);
              if (jsonResponse.id === command.id) {
                responseReceived = true;
                clearTimeout(timeout);
                mcpProcess.stdout.removeListener('data', dataHandler);
                resolve(jsonResponse);
                return;
              }
            }
          }
        } catch (e) {
          // Continue accumulating response
        }
      };

      mcpProcess.stdout.on('data', dataHandler);
      mcpProcess.stdin.write(JSON.stringify(command) + '\n');
    });
  }

  private async cleanup(): Promise<void> {
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
const test = new RealClaudeTest();
test.runRealTest().catch(console.error);