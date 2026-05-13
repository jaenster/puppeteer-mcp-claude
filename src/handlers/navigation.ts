import type { ServerState, MCPResponse, NavigateArgs } from '../types.js';
import { getPage } from '../state.js';
import { respond } from '../response.js';

export async function handleNavigate(
  args: NavigateArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, url, waitUntil = 'load' } = args;
  const page = getPage(state, pageId);

  await page.goto(url, { waitUntil });

  return respond({ ok: true, action: 'navigated', pageId, url, waitUntil });
}
