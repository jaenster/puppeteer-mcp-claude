import type { ServerState, MCPResponse } from '../types';

/**
 * Close the browser and all pages
 */
export async function handleCloseBrowser(
  _args: Record<string, never>,
  state: ServerState
): Promise<MCPResponse> {
  if (state.browser) {
    await state.browser.close();
    state.browser = null;
    state.pages.clear();
  }

  return {
    content: [{ type: 'text', text: 'Browser closed' }],
  };
}
