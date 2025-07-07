import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';

class MCPPuppeteerE2ETest {
  private mcpProcess: any;
  private httpServer: any;
  private testResults: string[] = [];

  async runTests() {
    console.log('🚀 Starting MCP Puppeteer E2E Tests...\n');
    
    try {
      await this.startTestServer();
      await this.startMCPServer();
      await this.runTestSuite();
      
      console.log('\n✅ All tests completed successfully!');
      console.log('\n📊 Test Results:');
      this.testResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result}`);
      });
      
    } catch (error) {
      console.error('❌ Tests failed:', error);
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

      this.httpServer.listen(3000, () => {
        console.log('🌐 Test server started on http://localhost:3000');
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  private async startMCPServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mcpProcess = spawn('ts-node', ['src/index.ts'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: join(__dirname, '..')
      });

      this.mcpProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('MCP Puppeteer server running on stdio')) {
          console.log('🔧 MCP Server started successfully');
          resolve();
        }
      });

      this.mcpProcess.on('error', reject);
      
      setTimeout(() => {
        reject(new Error('MCP Server failed to start within timeout'));
      }, 10000);
    });
  }

  private async sendMCPCommand(command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let response = '';
      let responseReceived = false;

      const timeout = setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('MCP command timeout'));
        }
      }, 15000);

      const dataHandler = (data: Buffer) => {
        response += data.toString();
        try {
          const jsonResponse = JSON.parse(response.trim());
          if (jsonResponse.id === command.id) {
            responseReceived = true;
            clearTimeout(timeout);
            this.mcpProcess.stdout.removeListener('data', dataHandler);
            resolve(jsonResponse);
          }
        } catch (e) {
          // Continue accumulating response
        }
      };

      this.mcpProcess.stdout.on('data', dataHandler);
      this.mcpProcess.stdin.write(JSON.stringify(command) + '\n');
    });
  }

  private async runTestSuite(): Promise<void> {
    console.log('🧪 Running test suite...\n');

    // Test 1: List available tools
    console.log('Test 1: Listing available tools...');
    const listToolsResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });
    
    if (listToolsResponse.result && listToolsResponse.result.tools.length > 0) {
      this.testResults.push('✅ Tools listing successful');
      console.log(`Found ${listToolsResponse.result.tools.length} tools`);
    } else {
      throw new Error('No tools found');
    }

    // Test 2: Launch browser
    console.log('\nTest 2: Launching browser...');
    const launchResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'puppeteer_launch',
        arguments: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      }
    });

    if (launchResponse.result) {
      this.testResults.push('✅ Browser launch successful');
      console.log('Browser launched successfully');
    } else {
      throw new Error('Browser launch failed');
    }

    // Test 3: Create new page
    console.log('\nTest 3: Creating new page...');
    const newPageResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'puppeteer_new_page',
        arguments: {
          pageId: 'test-page-1'
        }
      }
    });

    if (newPageResponse.result) {
      this.testResults.push('✅ New page creation successful');
      console.log('New page created successfully');
    } else {
      throw new Error('New page creation failed');
    }

    // Test 4: Navigate to local test site
    console.log('\nTest 4: Navigating to test site...');
    const navigateResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'puppeteer_navigate',
        arguments: {
          pageId: 'test-page-1',
          url: 'http://localhost:3000',
          waitUntil: 'domcontentloaded'
        }
      }
    });

    if (navigateResponse.result) {
      this.testResults.push('✅ Navigation successful');
      console.log('Navigation to test site successful');
    } else {
      throw new Error('Navigation failed');
    }

    // Test 5: Fill form and submit
    console.log('\nTest 5: Filling and submitting form...');
    
    // Type in name field
    await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'puppeteer_type',
        arguments: {
          pageId: 'test-page-1',
          selector: '#name',
          text: 'Claude Code Test'
        }
      }
    });

    // Type in email field
    await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'puppeteer_type',
        arguments: {
          pageId: 'test-page-1',
          selector: '#email',
          text: 'test@example.com'
        }
      }
    });

    // Submit form
    const submitResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'puppeteer_click',
        arguments: {
          pageId: 'test-page-1',
          selector: 'button[type="submit"]'
        }
      }
    });

    if (submitResponse.result) {
      this.testResults.push('✅ Form submission successful');
      console.log('Form filled and submitted successfully');
    } else {
      throw new Error('Form submission failed');
    }

    // Test 6: Wait for dynamic content
    console.log('\nTest 6: Waiting for delayed element...');
    const waitResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'puppeteer_wait_for_selector',
        arguments: {
          pageId: 'test-page-1',
          selector: '#delayed-element',
          timeout: 5000
        }
      }
    });

    if (waitResponse.result) {
      this.testResults.push('✅ Dynamic content wait successful');
      console.log('Successfully waited for delayed element');
    } else {
      throw new Error('Dynamic content wait failed');
    }

    // Test 7: Get text from result
    console.log('\nTest 7: Getting text from result...');
    const getTextResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'puppeteer_get_text',
        arguments: {
          pageId: 'test-page-1',
          selector: '#result-name'
        }
      }
    });

    if (getTextResponse.result && getTextResponse.result.content[0].text.includes('Claude Code Test')) {
      this.testResults.push('✅ Text extraction successful');
      console.log('Successfully extracted text from form result');
    } else {
      throw new Error('Text extraction failed');
    }

    // Test 8: Execute JavaScript
    console.log('\nTest 8: Executing JavaScript...');
    const evaluateResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'puppeteer_evaluate',
        arguments: {
          pageId: 'test-page-1',
          script: 'document.title'
        }
      }
    });

    if (evaluateResponse.result) {
      this.testResults.push('✅ JavaScript execution successful');
      console.log('JavaScript evaluation successful');
    } else {
      throw new Error('JavaScript execution failed');
    }

    // Test 9: Take screenshot
    console.log('\nTest 9: Taking screenshot...');
    const screenshotResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'puppeteer_screenshot',
        arguments: {
          pageId: 'test-page-1',
          path: 'test-screenshot.png',
          fullPage: false
        }
      }
    });

    if (screenshotResponse.result) {
      this.testResults.push('✅ Screenshot capture successful');
      console.log('Screenshot captured successfully');
    } else {
      throw new Error('Screenshot capture failed');
    }

    // Test 10: Close browser
    console.log('\nTest 10: Closing browser...');
    const closeResponse = await this.sendMCPCommand({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'puppeteer_close_browser',
        arguments: {}
      }
    });

    if (closeResponse.result) {
      this.testResults.push('✅ Browser close successful');
      console.log('Browser closed successfully');
    } else {
      throw new Error('Browser close failed');
    }
  }

  private async cleanup(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
    console.log('\n🧹 Cleanup completed');
  }
}

// Run the tests
const test = new MCPPuppeteerE2ETest();
test.runTests().catch(console.error);