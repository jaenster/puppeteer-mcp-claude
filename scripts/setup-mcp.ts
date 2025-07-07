#!/usr/bin/env ts-node

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

class MCPSetup {
  private claudeConfigPath: string;
  private projectPath: string;

  constructor() {
    this.claudeConfigPath = join(homedir(), '.claude', 'claude_desktop_config.json');
    this.projectPath = process.cwd();
  }

  async setup(): Promise<void> {
    console.log('🔧 Setting up MCP Puppeteer for Claude Code...\n');

    try {
      await this.ensureClaudeDirectory();
      await this.updateClaudeConfig();
      await this.verifySetup();
      
      console.log('\n✅ MCP Puppeteer setup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Restart Claude Code if it\'s running');
      console.log('   2. Run: npm run test:integration');
      console.log('   3. In Claude Code, try: "List all available tools"');
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }

  private async ensureClaudeDirectory(): Promise<void> {
    const claudeDir = join(homedir(), '.claude');
    
    if (!existsSync(claudeDir)) {
      console.log('📁 Creating .claude directory...');
      mkdirSync(claudeDir, { recursive: true });
    }
    
    console.log('✅ Claude directory ready');
  }

  private async updateClaudeConfig(): Promise<void> {
    console.log('📝 Updating Claude Code configuration...');
    
    let config: ClaudeConfig = {};
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

    // Check if puppeteer server already exists
    if (config.mcpServers.puppeteer) {
      console.log('⚠️  Puppeteer MCP server already configured');
      console.log('   Updating existing configuration...');
    }

    // Add/update our MCP server configuration
    config.mcpServers.puppeteer = {
      command: 'ts-node',
      args: ['src/index.ts'],
      cwd: this.projectPath,
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

  private async verifySetup(): Promise<void> {
    console.log('🔍 Verifying setup...');
    
    // Check if config file exists and is valid
    if (!existsSync(this.claudeConfigPath)) {
      throw new Error('Configuration file was not created');
    }

    try {
      const configContent = readFileSync(this.claudeConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (!config.mcpServers?.puppeteer) {
        throw new Error('Puppeteer MCP server not found in configuration');
      }
      
      const puppeteerConfig = config.mcpServers.puppeteer;
      
      // Verify configuration structure
      if (!puppeteerConfig.command || !puppeteerConfig.args || !puppeteerConfig.cwd) {
        throw new Error('Incomplete MCP server configuration');
      }
      
      console.log('✅ Configuration verified');
      console.log(`   Command: ${puppeteerConfig.command}`);
      console.log(`   Args: ${puppeteerConfig.args.join(' ')}`);
      console.log(`   Working Directory: ${puppeteerConfig.cwd}`);
      
    } catch (error) {
      throw new Error(`Configuration verification failed: ${error}`);
    }
  }

  async remove(): Promise<void> {
    console.log('🗑️  Removing MCP Puppeteer configuration...');
    
    if (!existsSync(this.claudeConfigPath)) {
      console.log('⚠️  No configuration file found');
      return;
    }

    try {
      const configContent = readFileSync(this.claudeConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers?.puppeteer) {
        delete config.mcpServers.puppeteer;
        writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
        console.log('✅ MCP Puppeteer configuration removed');
      } else {
        console.log('⚠️  MCP Puppeteer configuration not found');
      }
    } catch (error) {
      console.error('❌ Failed to remove configuration:', error);
    }
  }

  async status(): Promise<void> {
    console.log('📊 MCP Puppeteer Configuration Status\n');
    
    if (!existsSync(this.claudeConfigPath)) {
      console.log('❌ No Claude Code configuration found');
      console.log('   Run: npm run setup-mcp');
      return;
    }

    try {
      const configContent = readFileSync(this.claudeConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers?.puppeteer) {
        console.log('✅ MCP Puppeteer is configured');
        console.log('\n📋 Configuration:');
        console.log(`   Command: ${config.mcpServers.puppeteer.command}`);
        console.log(`   Args: ${config.mcpServers.puppeteer.args.join(' ')}`);
        console.log(`   Working Directory: ${config.mcpServers.puppeteer.cwd}`);
        console.log(`   Environment: ${JSON.stringify(config.mcpServers.puppeteer.env || {})}`);
      } else {
        console.log('❌ MCP Puppeteer is not configured');
        console.log('   Run: npm run setup-mcp');
      }
      
      // Show all MCP servers
      if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
        console.log('\n📋 All configured MCP servers:');
        Object.keys(config.mcpServers).forEach(serverName => {
          const isOurs = serverName === 'puppeteer' ? '← (this project)' : '';
          console.log(`   • ${serverName} ${isOurs}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to read configuration:', error);
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const mcpSetup = new MCPSetup();

  switch (command) {
    case 'setup':
      await mcpSetup.setup();
      break;
    case 'remove':
      await mcpSetup.remove();
      break;
    case 'status':
      await mcpSetup.status();
      break;
    default:
      console.log('🛠️  MCP Puppeteer Setup Tool\n');
      console.log('Usage:');
      console.log('  npm run setup-mcp           # Setup MCP configuration');
      console.log('  npm run setup-mcp remove    # Remove MCP configuration');
      console.log('  npm run setup-mcp status    # Show configuration status');
      break;
  }
}

main().catch(console.error);