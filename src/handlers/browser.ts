import type { ServerState, MCPResponse } from '../types.js';
import { respond } from '../response.js';

export async function handleCloseBrowser(
  _args: Record<string, never>,
  state: ServerState
): Promise<MCPResponse> {
  const wasOpen = state.browser !== null;
  if (state.browser) {
    await state.browser.close();
    state.browser = null;
  }
  state.pages.clear();
  state.currentViewport = null;
  state.currentUserAgent = null;
  state.currentStealth = false;

  return respond({ ok: true, action: 'browser_closed', wasOpen });
}
