#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');
const path = require('path');

class PuppeteerMCPInstaller {
  constructor() {
    this.packageDir = path.dirname(__dirname);
    this.claudeConfigPath = join(homedir(), '.claude', 'claude_desktop_config.json');
    this.serverName = 'puppeteer-mcp-claude';
  }

  async install() {
    console.log('🚀 Installing Puppeteer MCP Claude...\n');

    try {
      await this.ensureClaudeDirectory();
      await this.updateClaudeConfig();
      await this.verifyInstallation();
      
      console.log('\n✅ Puppeteer MCP Claude installed successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Restart Claude Code if it\'s running');
      console.log('   2. In Claude Code, ask: "List all available tools"');
      console.log('   3. You should see puppeteer tools listed');
      console.log('\n🔧 Management commands:');
      console.log('   npx puppeteer-mcp-claude uninstall  # Remove from Claude Code');
      console.log('   npx puppeteer-mcp-claude status     # Check installation status');
      console.log('\n📖 Documentation: https://github.com/jaenster/puppeteer-mcp-claude');
      
    } catch (error) {
      console.error('❌ Installation failed:', error.message);
      process.exit(1);
    }
  }

  async uninstall() {
    console.log('🗑️  Uninstalling Puppeteer MCP Claude...\n');
    
    if (!existsSync(this.claudeConfigPath)) {
      console.log('⚠️  No Claude Code configuration found');
      return;
    }

    try {
      const configContent = readFileSync(this.claudeConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers?.[this.serverName]) {
        delete config.mcpServers[this.serverName];
        writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
        console.log('✅ Puppeteer MCP Claude removed from Claude Code configuration');
        console.log('   Restart Claude Code to complete removal');
      } else {
        console.log('⚠️  Puppeteer MCP Claude was not found in configuration');
      }
    } catch (error) {
      console.error('❌ Failed to remove configuration:', error.message);
    }
  }

  async status() {
    console.log('📊 Puppeteer MCP Claude Status\n');
    
    if (!existsSync(this.claudeConfigPath)) {
      console.log('❌ No Claude Code configuration found');
      console.log('   Run: npx puppeteer-mcp-claude install');
      return;
    }

    try {
      const configContent = readFileSync(this.claudeConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers?.[this.serverName]) {
        console.log('✅ Puppeteer MCP Claude is installed');
        console.log('\n📋 Configuration:');
        const serverConfig = config.mcpServers[this.serverName];
        console.log(`   Command: ${serverConfig.command}`);
        console.log(`   Args: ${serverConfig.args?.join(' ') || 'none'}`);
        console.log(`   Working Directory: ${serverConfig.cwd || 'not set'}`);
        console.log(`   Environment: ${JSON.stringify(serverConfig.env || {})}`);
        
        // Check if the server executable exists
        if (serverConfig.cwd && existsSync(join(serverConfig.cwd, 'dist', 'index.js'))) {
          console.log('✅ Server executable found');
        } else {
          console.log('⚠️  Server executable not found - may need to rebuild');
        }
      } else {
        console.log('❌ Puppeteer MCP Claude is not installed');
        console.log('   Run: npx puppeteer-mcp-claude install');
      }
      
      // Show all MCP servers
      if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
        console.log('\n📋 All configured MCP servers:');
        Object.keys(config.mcpServers).forEach(serverName => {
          const isOurs = serverName === this.serverName ? ' ← (this package)' : '';
          console.log(`   • ${serverName}${isOurs}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to read configuration:', error.message);
    }
  }

  async ensureClaudeDirectory() {
    const claudeDir = join(homedir(), '.claude');
    
    if (!existsSync(claudeDir)) {
      console.log('📁 Creating .claude directory...');
      mkdirSync(claudeDir, { recursive: true });
    }
    
    console.log('✅ Claude directory ready');
  }

  async updateClaudeConfig() {
    console.log('📝 Updating Claude Code configuration...');
    
    let config = {};
    let hasExistingConfig = false;

    // Read existing config if it exists
    if (existsSync(this.claudeConfigPath)) {
      try {
        const configContent = readFileSync(this.claudeConfigPath, 'utf8');
        config = JSON.parse(configContent);
        hasExistingConfig = true;
        console.log('📖 Found existing configuration');
      } catch (error) {
        console.log('⚠️  Could not parse existing config, creating new one');
        config = {};
      }
    }

    // Initialize mcpServers if it doesn't exist
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Check if server already exists
    if (config.mcpServers[this.serverName]) {
      console.log('⚠️  Puppeteer MCP Claude already configured');
      console.log('   Updating existing configuration...');
    }

    // Get the globally installed package location
    const globalPackageDir = this.getGlobalPackageDir();

    // Add/update our MCP server configuration
    config.mcpServers[this.serverName] = {
      command: 'npx',
      args: ['puppeteer-mcp-claude', 'serve'],
      env: {
        NODE_ENV: 'production'
      }
    };

    // Write the updated configuration
    writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
    
    if (hasExistingConfig) {
      console.log('✅ Configuration updated');
    } else {
      console.log('✅ Configuration created');
    }
  }

  getGlobalPackageDir() {
    try {
      // Try to get the package directory from npm
      const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
      const packagePath = join(npmRoot, 'puppeteer-mcp-claude');
      
      if (existsSync(packagePath)) {
        return packagePath;
      }
    } catch (error) {
      // Fallback: use the current package directory
      console.log('⚠️  Using local package directory as fallback');
    }
    
    return this.packageDir;
  }

  async verifyInstallation() {
    console.log('🔍 Verifying installation...');
    
    // Check if config file exists and is valid
    if (!existsSync(this.claudeConfigPath)) {
      throw new Error('Configuration file was not created');
    }

    try {
      const configContent = readFileSync(this.claudeConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (!config.mcpServers?.[this.serverName]) {
        throw new Error('Puppeteer MCP Claude not found in configuration');
      }
      
      const serverConfig = config.mcpServers[this.serverName];
      
      // Verify configuration structure
      if (!serverConfig.command || !serverConfig.args) {
        throw new Error('Incomplete MCP server configuration');
      }
      
      // Verify server configuration (skip path check for npx commands)
      let serverInfo = '';
      if (serverConfig.command === 'npx' && serverConfig.args[0] === 'puppeteer-mcp-claude') {
        // For npx commands, we just verify the structure is correct
        console.log('✅ NPX configuration verified');
        serverInfo = `${serverConfig.command} ${serverConfig.args.join(' ')}`;
      } else {
        // For direct paths, check if the file exists
        const serverPath = serverConfig.args[0];
        if (!existsSync(serverPath)) {
          throw new Error(`Server executable not found at: ${serverPath}`);
        }
        console.log(`✅ Server executable found: ${serverPath}`);
        serverInfo = serverPath;
      }
      
      console.log('✅ Installation verified');
      console.log(`   Server: ${serverInfo}`);
      
    } catch (error) {
      throw new Error(`Installation verification failed: ${error.message}`);
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
    console.log('🤖 Puppeteer MCP Claude - Browser Automation for Claude Code\n');
    console.log('Usage:');
    console.log('  npx puppeteer-mcp-claude install    # Install MCP server for Claude Code');
    console.log('  npx puppeteer-mcp-claude uninstall  # Remove MCP server from Claude Code');
    console.log('  npx puppeteer-mcp-claude status     # Check installation status');
    console.log('  npx puppeteer-mcp-claude serve      # Start the MCP server (used internally)');
    console.log('  npx puppeteer-mcp-claude help       # Show this help message');
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