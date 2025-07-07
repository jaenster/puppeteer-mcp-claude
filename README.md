# MCP Puppeteer Server

A Model Context Protocol (MCP) server that provides Claude Code with comprehensive browser automation capabilities through Puppeteer. This server allows Claude to interact with web pages, take screenshots, execute JavaScript, and perform various browser automation tasks.

## Features

- **Browser Management**: Launch and close Chrome/Chromium browsers
- **Page Operations**: Create, navigate, and manage multiple browser tabs
- **Element Interaction**: Click, type, and extract text from web elements
- **JavaScript Execution**: Run custom JavaScript code in the browser context
- **Screenshot Capture**: Take full-page or viewport screenshots
- **Selector Waiting**: Wait for elements to appear with configurable timeouts
- **Multi-page Support**: Manage multiple browser tabs simultaneously

## Available Tools

| Tool | Description |
|------|-------------|
| `puppeteer_launch` | Launch a new browser instance |
| `puppeteer_new_page` | Create a new browser tab |
| `puppeteer_navigate` | Navigate to a URL |
| `puppeteer_click` | Click on an element |
| `puppeteer_type` | Type text into an input field |
| `puppeteer_get_text` | Extract text from an element |
| `puppeteer_screenshot` | Take a screenshot |
| `puppeteer_evaluate` | Execute JavaScript code |
| `puppeteer_wait_for_selector` | Wait for an element to appear |
| `puppeteer_close_page` | Close a specific tab |
| `puppeteer_close_browser` | Close the entire browser |

## Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd mcp-puppeteer
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

## Adding to Claude Code

### Method 1: Automatic Setup (Recommended)

Use the built-in setup script to automatically configure the MCP server:

```bash
npm run setup-mcp
```

This will:
- Create the necessary Claude Code configuration directory
- Add the MCP server configuration to your Claude Code settings
- Verify the setup is working correctly

### Method 2: Manual Configuration

1. **Create the Claude Code configuration directory** (if it doesn't exist):
   ```bash
   mkdir -p ~/.claude
   ```

2. **Add MCP server configuration**:
   
   Create or edit `~/.claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "puppeteer": {
         "command": "ts-node",
         "args": ["src/index.ts"],
         "cwd": "/path/to/your/mcp-puppeteer",
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

   **Important**: Replace `/path/to/your/mcp-puppeteer` with the actual absolute path to your cloned repository.

3. **Verify your configuration**:
   ```bash
   npm run status-mcp
   ```

### Method 3: Using Claude Code MCP Command

You can also configure this server using Claude Code's built-in MCP management:

```bash
claude mcp add puppeteer ts-node src/index.ts --cwd /path/to/mcp-puppeteer
```

## Post-Installation Steps

1. **Restart Claude Code** if it's currently running
2. **Test the integration**:
   ```bash
   npm run test:integration
   ```
3. **Verify in Claude Code** by asking: "List all available tools"

You should see the Puppeteer tools listed among the available tools.

## Usage Examples

### Basic Web Automation
```javascript
// Launch browser
await puppeteer_launch({ headless: false });

// Create a new page
await puppeteer_new_page({ pageId: "main" });

// Navigate to a website
await puppeteer_navigate({ 
  pageId: "main", 
  url: "https://example.com" 
});

// Take a screenshot
await puppeteer_screenshot({ 
  pageId: "main", 
  path: "screenshot.png" 
});
```

### Form Interaction
```javascript
// Type into a search field
await puppeteer_type({ 
  pageId: "main", 
  selector: "input[name='search']", 
  text: "Claude AI" 
});

// Click a button
await puppeteer_click({ 
  pageId: "main", 
  selector: "button[type='submit']" 
});

// Wait for results to load
await puppeteer_wait_for_selector({ 
  pageId: "main", 
  selector: ".search-results" 
});
```

### Data Extraction
```javascript
// Extract text from an element
await puppeteer_get_text({ 
  pageId: "main", 
  selector: "h1" 
});

// Execute custom JavaScript
await puppeteer_evaluate({ 
  pageId: "main", 
  script: "document.querySelectorAll('a').length" 
});
```

## Configuration Options

### Browser Launch Options
- `headless`: Run browser in headless mode (default: true)
- `args`: Array of Chrome arguments (e.g., `["--disable-web-security"]`)

### Navigation Options
- `waitUntil`: Wait condition for navigation
  - `load`: Wait for load event
  - `domcontentloaded`: Wait for DOM content loaded
  - `networkidle0`: Wait for no network activity
  - `networkidle2`: Wait for max 2 network connections

### Screenshot Options
- `path`: File path to save screenshot
- `fullPage`: Capture full page scroll height (default: false)

## Management Commands

| Command | Description |
|---------|-------------|
| `npm run setup-mcp` | Automatically configure MCP server |
| `npm run remove-mcp` | Remove MCP server configuration |
| `npm run status-mcp` | Check current configuration status |
| `npm run test:integration` | Test the MCP server integration |

## Troubleshooting

### Common Issues

1. **Claude Code doesn't see the tools**:
   - Ensure Claude Code is restarted after configuration
   - Check that the path in `claude_desktop_config.json` is correct
   - Verify the MCP server is configured properly with `npm run status-mcp`

2. **"Browser not launched" errors**:
   - Always call `puppeteer_launch` before using other tools
   - Make sure the browser launch was successful

3. **Element not found errors**:
   - Use `puppeteer_wait_for_selector` before interacting with elements
   - Verify selectors are correct using browser developer tools

4. **Permission errors**:
   - Make sure the project directory has proper permissions
   - Check that `ts-node` is installed and accessible

### Debug Mode

For debugging, you can run the server in development mode:
```bash
npm run dev
```

This will show detailed logs of all MCP operations.

### Testing

Run the test suite to verify everything is working:
```bash
npm test
```

For integration testing with Claude Code:
```bash
npm run test:integration
```

## Security Considerations

- The server runs with the same permissions as the user
- Browser instances are automatically cleaned up on exit
- All JavaScript execution happens in the browser context, not the Node.js process
- Network requests are subject to the same security policies as a regular Chrome browser

## Requirements

- Node.js 16 or higher
- Chrome/Chromium browser (automatically downloaded by Puppeteer)
- Claude Code with MCP support
- TypeScript support (`ts-node`)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your configuration with `npm run status-mcp`
3. Run the integration tests with `npm run test:integration`
4. Check Claude Code logs for MCP-related errors

For additional help, refer to the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).