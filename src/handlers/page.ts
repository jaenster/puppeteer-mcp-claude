import type { ServerState, MCPResponse, PageIdArgs } from '../types.js';
import { applyPageDefaults, getPage, requireBrowser } from '../state.js';
import { respond } from '../response.js';

export async function handleNewPage(
  args: PageIdArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId } = args;
  if (state.pages.has(pageId)) {
    throw new Error(`Page ${pageId} already exists; call puppeteer_close_page first or use a different pageId`);
  }
  const browser = requireBrowser(state);

  const page = await browser.newPage();
  await applyPageDefaults(page, state);
  state.pages.set(pageId, page);

  return respond({ ok: true, action: 'page_created', pageId });
}

export async function handleClosePage(
  args: PageIdArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId } = args;
  const page = getPage(state, pageId);

  await page.close();
  state.pages.delete(pageId);

  return respond({ ok: true, action: 'page_closed', pageId });
}
