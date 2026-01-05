import puppeteer from 'puppeteer';
import type { ServerState, MCPResponse, LaunchArgs, LogFunction } from '../types';

/**
 * Launch a new Puppeteer browser instance or connect to existing Chrome
 */
export async function handleLaunch(
  args: LaunchArgs,
  state: ServerState,
  log: LogFunction
): Promise<MCPResponse> {
  const {
    headless = true,
    args: browserArgs = [],
    executablePath,
    browserWSEndpoint,
    userDataDir,
    userAgent,
    viewport,
    proxy,
    stealth = false,
    slowMo,
  } = args;

  // Close existing browser if any
  if (state.browser) {
    await state.browser.close();
  }

  // Store viewport for later use in new pages
  state.currentViewport = viewport || null;

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless,
    slowMo,
    args: [...browserArgs, '--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: viewport || null,
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  if (userDataDir) {
    launchOptions.userDataDir = userDataDir;
  }

  if (stealth) {
    launchOptions.args!.push(
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
      '--disable-web-security',
      '--disable-features=site-per-process',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking'
    );
  }

  if (proxy?.server) {
    launchOptions.args!.push(`--proxy-server=${proxy.server}`);
  }

  if (browserWSEndpoint) {
    state.browser = await puppeteer.connect({
      browserWSEndpoint,
      defaultViewport: viewport || null,
    });
  } else {
    state.browser = await puppeteer.launch(launchOptions);
  }

  if (viewport || userAgent || stealth) {
    const pages = await state.browser.pages();
    if (pages.length > 0) {
      const page = pages[0];

      if (viewport) {
        await page.setViewport(viewport);
      }

      if (userAgent) {
        await page.setUserAgent(userAgent);
      } else if (stealth) {
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
      }

      if (stealth) {
        await page.evaluateOnNewDocument(`() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true
          });
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
            configurable: true
          });
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            configurable: true
          });
          window.chrome = { runtime: {} };
          Object.defineProperty(navigator, 'permissions', {
            get: () => ({
              query: () => Promise.resolve({ state: 'granted' })
            }),
            configurable: true
          });
        }`);
      }
    }
  }

  const connectionMethod = browserWSEndpoint
    ? 'Connected to existing browser'
    : 'Browser launched';

  return {
    content: [{ type: 'text', text: `${connectionMethod} successfully` }],
  };
}
