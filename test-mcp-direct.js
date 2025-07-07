// Simple test to demonstrate MCP server working
const { spawn } = require('child_process');

console.log('🚀 Testing MCP Puppeteer Server Direct Communication\n');

// Start the MCP server
const mcpProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

mcpProcess.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.includes('MCP Puppeteer server running')) {
    console.log('✅ MCP Server started successfully');
    
    // Test list tools
    const listToolsCommand = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    };
    
    mcpProcess.stdout.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.result && response.result.tools) {
          console.log(`✅ Found ${response.result.tools.length} tools:`);
          response.result.tools.forEach(tool => {
            console.log(`   • ${tool.name}: ${tool.description}`);
          });
          
          console.log('\n🎉 MCP Puppeteer server is working correctly!');
          console.log('\n📋 To use with Claude Code:');
          console.log('   1. Restart Claude Code to pick up MCP configuration');
          console.log('   2. Run: claude --dangerously-skip-permissions "List all available tools"');
          console.log('   3. Look for puppeteer tools in the output');
          
          mcpProcess.kill();
          process.exit(0);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
    
    mcpProcess.stdin.write(JSON.stringify(listToolsCommand) + '\n');
  }
});

mcpProcess.on('error', (error) => {
  console.error('❌ Failed to start MCP server:', error);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout');
  mcpProcess.kill();
  process.exit(1);
}, 10000);