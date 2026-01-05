import type { ServerState, MCPResponse, NavigateArgs } from '../types';
import { getPage } from '../state';

/**
 * Navigate to a URL
 */
export async function handleNavigate(
  args: NavigateArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, url, waitUntil = 'load' } = args;
  const page = getPage(state, pageId);

  await page.goto(url, { waitUntil });

  return {
    content: [{ type: 'text', text: `Navigated to ${url}` }],
  };
}
