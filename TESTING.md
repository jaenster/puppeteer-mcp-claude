# MCP Puppeteer Testing Instructions

## ✅ Setup Complete

The MCP Puppeteer server is now built and configured! Here's how to test it:

## 🔄 Restart Required

Since the MCP configuration was updated, **Claude Code needs to be restarted** to pick up the new server.

## 🧪 Manual Testing Steps

1. **Exit current Claude Code session**:
   ```bash
   # Press Ctrl+C or type exit
   ```

2. **Restart Claude Code**:
   ```bash
   claude --interactive
   ```

3. **Test MCP tools are available**:
   ```
   List all available tools
   ```
   You should see puppeteer tools in the output.

4. **Test browser automation**:
   ```
   Use puppeteer tools to launch a browser, navigate to google.com, and take a screenshot
   ```

## 🎯 Quick Console Test

Alternatively, test with a single command:

```bash
claude --dangerously-skip-permissions "Use puppeteer_launch to start a browser, then use puppeteer_new_page to create a page with ID 'test', then use puppeteer_navigate to go to google.com, then use puppeteer_screenshot to take a screenshot called 'google-test.png', then use puppeteer_close_browser to close the browser"
```

## 📁 Test with Local Site

The project includes a test site that runs on localhost:

1. **Start test server**:
   ```bash
   npm run test:real
   ```
   (This will start a server on http://localhost:3003)

2. **Test with Claude Code**:
   ```bash
   claude --dangerously-skip-permissions "Use puppeteer tools to navigate to http://localhost:3003, fill out the form with test data, submit it, and take a screenshot"
   ```

## 🛠️ Available Puppeteer Tools

- `puppeteer_launch` - Launch browser
- `puppeteer_new_page` - Create new page  
- `puppeteer_navigate` - Navigate to URL
- `puppeteer_click` - Click elements
- `puppeteer_type` - Type text
- `puppeteer_get_text` - Extract text
- `puppeteer_screenshot` - Take screenshots
- `puppeteer_evaluate` - Execute JavaScript
- `puppeteer_wait_for_selector` - Wait for elements
- `puppeteer_close_page` - Close page
- `puppeteer_close_browser` - Close browser

## 🔧 Configuration Status

Check MCP configuration anytime with:
```bash
npm run status-mcp
```

## 🧹 Cleanup

Remove MCP configuration:
```bash
npm run remove-mcp
```

---

**Note**: The current Claude Code session was running before MCP configuration, so restart is required to load the Puppeteer tools.