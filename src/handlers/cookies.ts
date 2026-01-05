import type {
  ServerState,
  MCPResponse,
  SetCookiesArgs,
  GetCookiesArgs,
  DeleteCookiesArgs,
} from '../types';
import { getPage } from '../state';

/**
 * Set cookies for a page
 */
export async function handleSetCookies(
  args: SetCookiesArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, cookies } = args;
  const page = getPage(state, pageId);

  await page.setCookie(...cookies);

  return {
    content: [
      {
        type: 'text',
        text: `Set ${cookies.length} cookie(s) for page ${pageId}`,
      },
    ],
  };
}

/**
 * Get cookies from a page
 */
export async function handleGetCookies(
  args: GetCookiesArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, urls } = args;
  const page = getPage(state, pageId);

  const cookies = urls ? await page.cookies(...urls) : await page.cookies();

  return {
    content: [
      {
        type: 'text',
        text: `Retrieved cookies: ${JSON.stringify(cookies, null, 2)}`,
      },
    ],
  };
}

/**
 * Delete cookies from a page
 */
export async function handleDeleteCookies(
  args: DeleteCookiesArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, cookies } = args;
  const page = getPage(state, pageId);

  await page.deleteCookie(...cookies);

  return {
    content: [
      {
        type: 'text',
        text: `Deleted ${cookies.length} cookie(s) from page ${pageId}`,
      },
    ],
  };
}
