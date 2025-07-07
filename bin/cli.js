#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { homedir, platform } = require('os');
const path = require('path');

class PuppeteerMCPInstaller {
  constructor() {
    this.packageDir = path.dirname(__dirname);
    this.serverName = 'puppeteer-mcp-claude';
    this.configs = this.getConfigPaths();
  }

  getConfigPaths() {
    const home = homedir();
    const os = platform();
    
    const configs = [];
    
    // Claude Desktop paths
    if (os === 'darwin') { // macOS
      configs.push({
        name: 'Claude Desktop (macOS)',
        path: join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        type: 'desktop'
      });
    } else if (os === 'linux') {
      configs.push({
        name: 'Claude Desktop (Linux)',
        path: join(home, '.config', 'Claude', 'claude_desktop_config.json'),
        type: 'desktop'
      });
    }
    
    // Claude Code paths (cross-platform)
    configs.push({
      name: 'Claude Code',
      path: join(home, '.claude', 'claude_desktop_config.json'),
      type: 'code'
    });
    
    return configs;
  }

  async install() {
    console.log('🚀 Installing Puppeteer MCP Claude...\n');

    try {
      const installedConfigs = await this.detectAndInstall();
      
      if (installedConfigs.length === 0) {
        console.log('⚠️  No Claude applications detected.');
        console.log('   Creating configuration for Claude Code...');
        await this.installForConfig(this.configs.find(c => c.type === 'code'));
        installedConfigs.push('Claude Code');
      }
      
      console.log('\n✅ Puppeteer MCP Claude installed successfully!');
      console.log(`\n📱 Installed for: ${installedConfigs.join(', ')}`);
      
      console.log('\n📋 Next steps:');
      installedConfigs.forEach(app => {
        if (app.includes('Desktop')) {
          console.log(`   • Restart Claude Desktop if it's running`);
        }
        if (app.includes('Code')) {
          console.log(`   • Restart Claude Code if it's running`);
        }
      });
      
      console.log('   • Ask Claude: "List all available tools"');
      console.log('   • You should see 11 puppeteer tools listed');
      
      console.log('\n🔧 Management commands:');
      console.log('   npx puppeteer-mcp-claude uninstall  # Remove from all Claude apps');
      console.log('   npx puppeteer-mcp-claude status     # Check installation status');
      console.log('\n📖 Documentation: https://github.com/jaenster/puppeteer-mcp-claude');
      
    } catch (error) {
      console.error('❌ Installation failed:', error.message);
      process.exit(1);
    }
  }

  async detectAndInstall() {
    const installedConfigs = [];
    
    console.log('🔍 Detecting Claude applications...\n');
    
    for (const config of this.configs) {
      const hasExistingConfig = existsSync(config.path);
      const hasClaudeApp = await this.detectClaudeApp(config);
      
      if (hasExistingConfig || hasClaudeApp) {
        console.log(`✅ Found ${config.name}`);
        await this.installForConfig(config);
        installedConfigs.push(config.name);
      } else {
        console.log(`⚪ ${config.name} not detected`);
      }
    }
    
    return installedConfigs;
  }

  async detectClaudeApp(config) {
    if (config.type === 'desktop') {
      // Check if Claude Desktop is installed
      const os = platform();
      if (os === 'darwin') {
        return existsSync('/Applications/Claude.app') || 
               existsSync(join(homedir(), 'Applications', 'Claude.app'));
      } else if (os === 'linux') {
        try {
          execSync('which claude-desktop', { stdio: 'ignore' });
          return true;
        } catch {
          // Check common installation paths
          return existsSync('/usr/bin/claude-desktop') ||
                 existsSync('/usr/local/bin/claude-desktop') ||
                 existsSync(join(homedir(), '.local', 'bin', 'claude-desktop'));
        }
      }
    } else if (config.type === 'code') {
      // Check if Claude Code is installed
      try {
        execSync('which claude', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async installForConfig(config) {
    console.log(`📝 Configuring ${config.name}...`);
    
    // Use claude mcp add for Claude Code
    if (config.type === 'code') {
      console.log('🔧 Using claude mcp add command...');
      execSync(`claude mcp add ${this.serverName} "node ${join(this.packageDir, 'dist', 'index.js')}"`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log(`✅ Successfully added via claude mcp add`);
      return;
    }
    
    // Manual configuration for Claude Desktop
    const configDir = path.dirname(config.path);
    if (!existsSync(configDir)) {
      console.log(`📁 Creating directory: ${configDir}`);
      mkdirSync(configDir, { recursive: true });
    }
    
    let claudeConfig = {};
    let hasExistingConfig = false;

    if (existsSync(config.path)) {
      try {
        const configContent = readFileSync(config.path, 'utf8');
        claudeConfig = JSON.parse(configContent);
        hasExistingConfig = true;
        console.log(`📖 Found existing configuration`);
      } catch (error) {
        console.log(`⚠️  Could not parse existing config, creating new one`);
        claudeConfig = {};
      }
    }

    if (!claudeConfig.mcpServers) {
      claudeConfig.mcpServers = {};
    }

    if (claudeConfig.mcpServers[this.serverName]) {
      console.log(`⚠️  Puppeteer MCP already configured, updating...`);
    }

    claudeConfig.mcpServers[this.serverName] = {
      command: 'node',
      args: [join(this.packageDir, 'dist', 'index.js')],
      cwd: this.packageDir,
      env: {
        NODE_ENV: 'production'
      }
    };

    writeFileSync(config.path, JSON.stringify(claudeConfig, null, 2));
    
    if (hasExistingConfig) {
      console.log(`✅ Configuration updated: ${config.path}`);
    } else {
      console.log(`✅ Configuration created: ${config.path}`);
    }

    await this.verifyInstallationForConfig(config, claudeConfig);
  }

  async verifyInstallationForConfig(config, claudeConfig) {
    console.log(`🔍 Verifying ${config.name} installation...`);
    
    try {
      // If claude mcp add was used, the configuration might not be in the expected format
      // So we'll read the config file again to verify
      if (existsSync(config.path)) {
        const configContent = readFileSync(config.path, 'utf8');
        const currentConfig = JSON.parse(configContent);
        
        if (currentConfig.mcpServers?.[this.serverName]) {
          const serverConfig = currentConfig.mcpServers[this.serverName];
          
          if (!serverConfig.command || !serverConfig.args) {
            throw new Error('Incomplete MCP server configuration');
          }
          
          // Verify either npx or node command structure
          if ((serverConfig.command === 'npx' && serverConfig.args[0] === 'puppeteer-mcp-claude') ||
              (serverConfig.command === 'node' && serverConfig.args[0].includes('dist/index.js'))) {
            console.log(`✅ ${config.name} configuration verified`);
          } else {
            console.log(`✅ ${config.name} configuration verified (custom format)`);
          }
        } else {
          throw new Error(`${this.serverName} not found in configuration`);
        }
      } else {
        throw new Error('Configuration file not found');
      }
      
    } catch (error) {
      throw new Error(`${config.name} verification failed: ${error.message}`);
    }
  }

  async uninstall() {
    console.log('🗑️  Uninstalling Puppeteer MCP Claude...\n');
    
    let removedCount = 0;
    
    for (const config of this.configs) {
      if (existsSync(config.path)) {
        try {
          const configContent = readFileSync(config.path, 'utf8');
          const claudeConfig = JSON.parse(configContent);
          
          if (claudeConfig.mcpServers?.[this.serverName]) {
            delete claudeConfig.mcpServers[this.serverName];
            writeFileSync(config.path, JSON.stringify(claudeConfig, null, 2));
            console.log(`✅ Removed from ${config.name}`);
            removedCount++;
          } else {
            console.log(`⚪ Not configured in ${config.name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to remove from ${config.name}:`, error.message);
        }
      } else {
        console.log(`⚪ ${config.name} config not found`);
      }
    }
    
    if (removedCount > 0) {
      console.log(`\n✅ Puppeteer MCP Claude removed from ${removedCount} configuration(s)`);
      console.log('   Restart Claude applications to complete removal');
    } else {
      console.log('\n⚠️  Puppeteer MCP Claude was not found in any configurations');
    }
  }

  async status() {
    console.log('📊 Puppeteer MCP Claude Status\n');
    
    let foundCount = 0;
    
    for (const config of this.configs) {
      console.log(`📱 ${config.name}:`);
      
      if (!existsSync(config.path)) {
        console.log(`   ❌ No configuration found`);
        console.log(`   📁 Config path: ${config.path}`);
        continue;
      }

      try {
        const configContent = readFileSync(config.path, 'utf8');
        const claudeConfig = JSON.parse(configContent);
        
        if (claudeConfig.mcpServers?.[this.serverName]) {
          console.log(`   ✅ Puppeteer MCP Claude is installed`);
          foundCount++;
          
          const serverConfig = claudeConfig.mcpServers[this.serverName];
          console.log(`   📋 Command: ${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`);
          console.log(`   🌍 Environment: ${JSON.stringify(serverConfig.env || {})}`);
          
          // Show app detection
          const appDetected = await this.detectClaudeApp(config);
          console.log(`   🔍 App detected: ${appDetected ? '✅ Yes' : '❌ No'}`);
        } else {
          console.log(`   ❌ Puppeteer MCP Claude is not installed`);
        }
        
        // Show all MCP servers for this config
        if (claudeConfig.mcpServers && Object.keys(claudeConfig.mcpServers).length > 0) {
          console.log(`   📋 All MCP servers: ${Object.keys(claudeConfig.mcpServers).map(name => 
            name === this.serverName ? `${name} ← (this package)` : name
          ).join(', ')}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to read configuration: ${error.message}`);
      }
      
      console.log(); // Empty line between configs
    }
    
    if (foundCount === 0) {
      console.log('💡 To install, run: npx puppeteer-mcp-claude install');
    } else {
      console.log(`✅ Installed in ${foundCount} of ${this.configs.length} possible locations`);
    }
  }

  async serve() {
    // Start the MCP server
    const serverPath = join(this.packageDir, 'dist', 'index.js');
    if (!existsSync(serverPath)) {
      console.error('❌ Server executable not found. Please ensure the package is built properly.');
      process.exit(1);
    }
    
    // Execute the server
    const server = spawn('node', [serverPath], {
      stdio: 'inherit',
      cwd: this.packageDir
    });
    
    server.on('error', (error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });
    
    server.on('exit', (code) => {
      process.exit(code);
    });
  }

  async startChrome(port = 9222, userDataDir = null) {
    console.log(`🚀 Starting Chrome with remote debugging on port ${port}...\n`);
    
    const os = platform();
    let chromePath;
    
    // Find Chrome executable
    if (os === 'darwin') {
      chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      if (!existsSync(chromePath)) {
        chromePath = '/Applications/Chromium.app/Contents/MacOS/Chromium';
      }
    } else if (os === 'linux') {
      try {
        chromePath = execSync('which google-chrome', { encoding: 'utf8' }).trim();
      } catch {
        try {
          chromePath = execSync('which chromium-browser', { encoding: 'utf8' }).trim();
        } catch {
          chromePath = execSync('which chromium', { encoding: 'utf8' }).trim();
        }
      }
    } else if (os === 'win32') {
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        join(homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
      ];
      chromePath = possiblePaths.find(p => existsSync(p));
    }
    
    if (!chromePath || !existsSync(chromePath)) {
      console.error('❌ Chrome/Chromium not found. Please install Chrome or Chromium.');
      process.exit(1);
    }
    
    // Set up user data directory
    if (!userDataDir) {
      userDataDir = join(homedir(), '.chrome-debug-data');
    }
    
    if (!existsSync(userDataDir)) {
      mkdirSync(userDataDir, { recursive: true });
    }
    
    // Chrome arguments
    const chromeArgs = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];
    
    console.log(`📂 User data directory: ${userDataDir}`);
    console.log(`🌐 Debug endpoint: http://localhost:${port}`);
    console.log(`🔗 WebSocket endpoint: ws://localhost:${port}`);
    console.log(`\n💡 To connect from MCP, use browserWSEndpoint: "ws://localhost:${port}"\n`);
    
    // Launch Chrome
    const chrome = spawn(chromePath, chromeArgs, {
      stdio: 'ignore',
      detached: true
    });
    
    chrome.on('error', (error) => {
      console.error('❌ Failed to start Chrome:', error);
      process.exit(1);
    });
    
    // Don't wait for Chrome to exit, let it run in background
    chrome.unref();
    
    console.log(`✅ Chrome started successfully with PID ${chrome.pid}`);
    console.log('🚪 Chrome is running in the background. Close manually when done.');
    
    // Give Chrome a moment to start
    setTimeout(() => {
      console.log('\n🔧 You can now use the MCP server with:');
      console.log('   puppeteer_launch with browserWSEndpoint: "ws://localhost:9222"');
    }, 2000);
  }

  showHelp() {
    console.log('🤖 Puppeteer MCP Claude - Browser Automation for Claude Desktop & Code\n');
    console.log('Usage:');
    console.log('  npx puppeteer-mcp-claude install    # Install for Claude Desktop & Code');
    console.log('  npx puppeteer-mcp-claude uninstall  # Remove from all Claude apps');
    console.log('  npx puppeteer-mcp-claude status     # Check installation status');
    console.log('  npx puppeteer-mcp-claude serve      # Start the MCP server (used internally)');
    console.log('  npx puppeteer-mcp-claude chrome     # Start Chrome with remote debugging');
    console.log('  npx puppeteer-mcp-claude help       # Show this help message');
    console.log('\n🖥️  Supported Platforms:');
    console.log('  • macOS - Claude Desktop + Claude Code');
    console.log('  • Linux - Claude Desktop + Claude Code'); 
    console.log('  • Windows - Claude Code only');
    console.log('\nAvailable Browser Tools:');
    console.log('  • puppeteer_launch         - Launch browser instance');
    console.log('  • puppeteer_new_page       - Create new browser tab');
    console.log('  • puppeteer_navigate       - Navigate to URL');
    console.log('  • puppeteer_click          - Click elements');
    console.log('  • puppeteer_type           - Type text into inputs');
    console.log('  • puppeteer_get_text       - Extract text from elements');
    console.log('  • puppeteer_screenshot     - Capture screenshots');
    console.log('  • puppeteer_evaluate       - Execute JavaScript');
    console.log('  • puppeteer_wait_for_selector - Wait for elements');
    console.log('  • puppeteer_close_page     - Close browser tab');
    console.log('  • puppeteer_close_browser  - Close entire browser');
    console.log('  • puppeteer_set_cookies    - Manage cookies');
    console.log('  • puppeteer_get_cookies    - Read cookies');
    console.log('  • puppeteer_delete_cookies - Delete cookies');
    console.log('  • puppeteer_set_request_interception - Block/modify requests');
    console.log('\n🌐 Chrome Remote Debugging:');
    console.log('  npx puppeteer-mcp-claude chrome [port] [dataDir]');
    console.log('  Example: npx puppeteer-mcp-claude chrome 9222');
    console.log('  Then use browserWSEndpoint: "ws://localhost:9222" in puppeteer_launch');
    console.log('\nDocumentation: https://github.com/jaenster/puppeteer-mcp-claude');
    console.log('Issues: https://github.com/jaenster/puppeteer-mcp-claude/issues');
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const installer = new PuppeteerMCPInstaller();

  switch (command) {
    case 'install':
      await installer.install();
      break;
    case 'uninstall':
      await installer.uninstall();
      break;
    case 'status':
      await installer.status();
      break;
    case 'serve':
      await installer.serve();
      break;
    case 'chrome':
      const port = process.argv[3] ? parseInt(process.argv[3]) : 9222;
      const userDataDir = process.argv[4] || null;
      await installer.startChrome(port, userDataDir);
      break;
    case 'help':
    case '--help':
    case '-h':
      installer.showHelp();
      break;
    default:
      if (!command) {
        installer.showHelp();
      } else {
        console.error(`Unknown command: ${command}`);
        console.log('Run "npx puppeteer-mcp-claude help" for usage information.');
        process.exit(1);
      }
      break;
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});