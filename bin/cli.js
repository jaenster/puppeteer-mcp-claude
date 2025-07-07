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
    
    // Ensure directory exists
    const configDir = path.dirname(config.path);
    if (!existsSync(configDir)) {
      console.log(`📁 Creating directory: ${configDir}`);
      mkdirSync(configDir, { recursive: true });
    }
    
    // Read or create config
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

    // Initialize mcpServers if it doesn't exist
    if (!claudeConfig.mcpServers) {
      claudeConfig.mcpServers = {};
    }

    // Check if our server already exists
    if (claudeConfig.mcpServers[this.serverName]) {
      console.log(`⚠️  Puppeteer MCP already configured, updating...`);
    }

    // Add/update our MCP server configuration
    claudeConfig.mcpServers[this.serverName] = {
      command: 'npx',
      args: ['puppeteer-mcp-claude', 'serve'],
      env: {
        NODE_ENV: 'production'
      }
    };

    // Write the updated configuration
    writeFileSync(config.path, JSON.stringify(claudeConfig, null, 2));
    
    if (hasExistingConfig) {
      console.log(`✅ Configuration updated: ${config.path}`);
    } else {
      console.log(`✅ Configuration created: ${config.path}`);
    }

    // Verify the installation
    await this.verifyInstallationForConfig(config, claudeConfig);
  }

  async verifyInstallationForConfig(config, claudeConfig) {
    console.log(`🔍 Verifying ${config.name} installation...`);
    
    try {
      if (!claudeConfig.mcpServers?.[this.serverName]) {
        throw new Error(`${this.serverName} not found in configuration`);
      }
      
      const serverConfig = claudeConfig.mcpServers[this.serverName];
      
      if (!serverConfig.command || !serverConfig.args) {
        throw new Error('Incomplete MCP server configuration');
      }
      
      // For npx commands, verify structure
      if (serverConfig.command === 'npx' && serverConfig.args[0] === 'puppeteer-mcp-claude') {
        console.log(`✅ ${config.name} configuration verified`);
      } else {
        throw new Error('Invalid server configuration');
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

  showHelp() {
    console.log('🤖 Puppeteer MCP Claude - Browser Automation for Claude Desktop & Code\n');
    console.log('Usage:');
    console.log('  npx puppeteer-mcp-claude install    # Install for Claude Desktop & Code');
    console.log('  npx puppeteer-mcp-claude uninstall  # Remove from all Claude apps');
    console.log('  npx puppeteer-mcp-claude status     # Check installation status');
    console.log('  npx puppeteer-mcp-claude serve      # Start the MCP server (used internally)');
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