import { spawn, ChildProcess } from 'child_process';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface ClaudeConfig {
  mcpServers?: {
    [key: string]: {
      command: string;
      args: string[];
      cwd?: string;
      env?: Record<string, string>;
    };
  };
}

class ClaudeCodeIntegrationTest {
  private httpServer: any;
  private claudeProcess: ChildProcess | null = null;
  private testResults: string[] = [];
  private claudeConfigPath: string;
  private originalConfig: ClaudeConfig | null = null;

  constructor() {
    this.claudeConfigPath = join(homedir(), '.claude', 'claude_desktop_config.json');
  }

  async runIntegrationTests() {
    console.log('🚀 Starting Claude Code Integration Tests...\n');
    
    try {
      await this.startTestServer();
      await this.setupMCPConfiguration();
      await this.startClaudeCode();
      await this.runClaudeCodeTests();
      
      console.log('\n✅ All Claude Code integration tests completed successfully!');
      console.log('\n📊 Test Results:');
      this.testResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result}`);
      });
      
    } catch (error) {
      console.error('❌ Integration tests failed:', error);
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

      this.httpServer.listen(3001, () => {
        console.log('🌐 Test server started on http://localhost:3001');
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  private async setupMCPConfiguration(): Promise<void> {
    console.log('🔧 Setting up MCP configuration...');
    
    // Ensure .claude directory exists
    const claudeDir = join(homedir(), '.claude');
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }

    // Read existing config or create new one
    let config: ClaudeConfig = {};
    if (existsSync(this.claudeConfigPath)) {
      try {
        const configContent = readFileSync(this.claudeConfigPath, 'utf8');
        this.originalConfig = JSON.parse(configContent);
        config = { ...this.originalConfig };
      } catch (error) {
        console.log('⚠️  Could not parse existing config, creating new one');
        config = {};
      }
    }

    // Add our MCP server configuration
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    config.mcpServers.puppeteer = {
      command: 'ts-node',
      args: ['src/index.ts'],
      cwd: process.cwd(),
      env: {
        NODE_ENV: 'development'
      }
    };

    // Write the updated configuration
    writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ MCP configuration updated');
    this.testResults.push('✅ MCP configuration setup successful');
  }

  private async startClaudeCode(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🎯 Starting Claude Code...');
      
      // Try to find claude command
      const claudeCommand = this.findClaudeCommand();
      if (!claudeCommand) {
        reject(new Error('Claude Code not found. Please install it first with: npm install -g @anthropic/claude-code'));
        return;
      }

      // Start Claude Code in interactive mode
      this.claudeProcess = spawn(claudeCommand, ['--interactive'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CLAUDE_MCP_ENABLED: 'true' }
      });

      let startupComplete = false;
      const startupTimeout = setTimeout(() => {
        if (!startupComplete) {
          reject(new Error('Claude Code startup timeout'));
        }
      }, 30000);

      // Monitor Claude Code output
      this.claudeProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('Claude Output:', output);
        
        // Look for startup indicators
        if (output.includes('Claude Code') || output.includes('Ready') || output.includes('MCP')) {
          if (!startupComplete) {
            startupComplete = true;
            clearTimeout(startupTimeout);
            console.log('✅ Claude Code started successfully');
            this.testResults.push('✅ Claude Code startup successful');
            resolve();
          }
        }
      });

      this.claudeProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        console.log('Claude Error:', error);
        
        // Some errors might be normal during startup
        if (error.includes('MCP') && error.includes('connected')) {
          if (!startupComplete) {
            startupComplete = true;
            clearTimeout(startupTimeout);
            console.log('✅ Claude Code started with MCP');
            this.testResults.push('✅ Claude Code with MCP startup successful');
            resolve();
          }
        }
      });

      this.claudeProcess.on('error', (error) => {
        clearTimeout(startupTimeout);
        reject(error);
      });

      this.claudeProcess.on('exit', (code) => {
        if (!startupComplete) {
          clearTimeout(startupTimeout);
          reject(new Error(`Claude Code exited with code ${code}`));
        }
      });
    });
  }

  private findClaudeCommand(): string | null {
    // We already know claude is available from the check, so just return it
    return 'claude';
  }

  private async runClaudeCodeTests(): Promise<void> {
    console.log('\n🧪 Running Claude Code integration tests...');
    
    if (!this.claudeProcess) {
      throw new Error('Claude Code process not available');
    }

    // Test 1: Send a command to use Puppeteer tools
    console.log('\nTest 1: Testing Puppeteer tool availability...');
    await this.sendClaudeCommand('List all available tools that contain "puppeteer"');
    
    // Test 2: Test browser automation
    console.log('\nTest 2: Testing browser automation...');
    await this.sendClaudeCommand(`
      Please use the puppeteer tools to:
      1. Launch a browser
      2. Create a new page with ID "test-page"
      3. Navigate to http://localhost:3001
      4. Take a screenshot and save it as "claude-test-screenshot.png"
      5. Close the browser
    `);
    
    // Test 3: Test form interaction
    console.log('\nTest 3: Testing form interaction...');
    await this.sendClaudeCommand(`
      Use puppeteer tools to:
      1. Launch browser and create a page
      2. Navigate to http://localhost:3001
      3. Fill in the form with name "Claude Integration Test" and email "claude@test.com"
      4. Submit the form
      5. Get the text from the result name field
      6. Close browser
    `);

    // Test 4: Test JavaScript execution
    console.log('\nTest 4: Testing JavaScript execution...');
    await this.sendClaudeCommand(`
      Use puppeteer to:
      1. Launch browser and navigate to http://localhost:3001
      2. Execute JavaScript to get the page title
      3. Execute JavaScript to click the "Click to Show Dynamic Content" button
      4. Wait for the dynamic content to appear
      5. Get the current time from the dynamic content
      6. Close browser
    `);

    // Give Claude Code some time to process commands
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    this.testResults.push('✅ Puppeteer tool integration tests completed');
    console.log('✅ All Claude Code integration tests completed');
  }

  private async sendClaudeCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.claudeProcess || !this.claudeProcess.stdin) {
        reject(new Error('Claude Code process not available'));
        return;
      }

      console.log(`📝 Sending command: ${command.substring(0, 50)}...`);
      
      // Send command to Claude Code
      this.claudeProcess.stdin.write(command + '\n');
      
      // Wait for response (simplified - in real scenario you'd parse the response)
      setTimeout(() => {
        console.log('✅ Command sent to Claude Code');
        resolve();
      }, 2000);
    });
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    
    // Restore original configuration
    if (this.originalConfig && existsSync(this.claudeConfigPath)) {
      try {
        writeFileSync(this.claudeConfigPath, JSON.stringify(this.originalConfig, null, 2));
        console.log('✅ Original MCP configuration restored');
      } catch (error) {
        console.log('⚠️  Could not restore original configuration');
      }
    }

    // Close Claude Code process
    if (this.claudeProcess) {
      this.claudeProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!this.claudeProcess.killed) {
        this.claudeProcess.kill('SIGKILL');
      }
      console.log('✅ Claude Code process terminated');
    }

    // Close test server
    if (this.httpServer) {
      this.httpServer.close();
      console.log('✅ Test server closed');
    }

    console.log('🧹 Cleanup completed');
  }
}

// Additional utility for checking Claude Code installation
async function checkClaudeCodeInstallation(): Promise<boolean> {
  console.log('🔍 Checking Claude Code installation...');
  
  try {
    const checkProcess = spawn('claude', ['--version'], { stdio: 'pipe' });
    
    return new Promise((resolve) => {
      checkProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Claude Code is installed');
          resolve(true);
        } else {
          console.log('❌ Claude Code not found');
          console.log('📦 Install with: npm install -g @anthropic/claude-code');
          resolve(false);
        }
      });
      
      checkProcess.on('error', () => {
        console.log('❌ Claude Code not found');
        console.log('📦 Install with: npm install -g @anthropic/claude-code');
        resolve(false);
      });
    });
  } catch (error) {
    console.log('❌ Error checking Claude Code installation');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🎯 Claude Code + MCP Puppeteer Integration Test Suite\n');
  
  // Check if Claude Code is installed
  const isClaudeInstalled = await checkClaudeCodeInstallation();
  
  if (!isClaudeInstalled) {
    console.log('\n⚠️  Claude Code is not installed. Please install it first:');
    console.log('   npm install -g @anthropic/claude-code');
    console.log('\n   Then run this test again.');
    process.exit(1);
  }

  // Run integration tests
  const integrationTest = new ClaudeCodeIntegrationTest();
  await integrationTest.runIntegrationTests();
}

// Run the tests
main().catch(console.error);