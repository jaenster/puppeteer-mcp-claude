import { getPuppeteer } from '../puppeteer.js';
import type { ServerState, MCPResponse, LaunchArgs, LogFunction } from '../types.js';
import { DEFAULT_PAGE_ID, applyPageDefaults } from '../state.js';
import { respond } from '../response.js';

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

  if (state.browser) {
    await state.browser.close();
    state.pages.clear();
  }

  // Capture session-level defaults so later auto-created pages inherit them.
  state.currentViewport = viewport || null;
  state.currentUserAgent = userAgent || null;
  state.currentStealth = stealth;

  const puppeteer = getPuppeteer();

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless,
    slowMo,
    args: [...browserArgs, '--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: viewport || null,
  };

  if (executablePath) launchOptions.executablePath = executablePath;
  if (userDataDir) launchOptions.userDataDir = userDataDir;

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

  // Apply session defaults to the browser's initial blank page and register
  // it as `default` so the lazy-page path reuses it instead of opening a
  // second tab that would skip these defaults.
  const initialPages = await state.browser.pages();
  if (initialPages.length > 0) {
    const page = initialPages[0];
    await applyPageDefaults(page, state);
    if (!state.pages.has(DEFAULT_PAGE_ID)) {
      state.pages.set(DEFAULT_PAGE_ID, page);
    }
  }

  return respond({
    ok: true,
    action: browserWSEndpoint ? 'browser_connected' : 'browser_launched',
    headless,
    stealth,
  });
}
