import type { ServerState, MCPResponse, PageIdArgs } from '../types';
import { getPage, requireBrowser } from '../state';

/**
 * Create a new page in the browser
 */
export async function handleNewPage(
  args: PageIdArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId } = args;
  const browser = requireBrowser(state);

  const page = await browser.newPage();

  // Apply stored viewport to new page
  if (state.currentViewport) {
    await page.setViewport(state.currentViewport);
  }

  state.pages.set(pageId, page);

  return {
    content: [{ type: 'text', text: `Page ${pageId} created successfully` }],
  };
}

/**
 * Close a specific page
 */
export async function handleClosePage(
  args: PageIdArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId } = args;
  const page = getPage(state, pageId);

  await page.close();
  state.pages.delete(pageId);

  return {
    content: [{ type: 'text', text: `Page ${pageId} closed` }],
  };
}
