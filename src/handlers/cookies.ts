import type {
  ServerState,
  MCPResponse,
  SetCookiesArgs,
  GetCookiesArgs,
  DeleteCookiesArgs,
} from '../types.js';
import { getPage } from '../state.js';
import { respond } from '../response.js';

export async function handleSetCookies(
  args: SetCookiesArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, cookies } = args;
  const page = getPage(state, pageId);

  await page.setCookie(...cookies);

  return respond({ ok: true, action: 'cookies_set', pageId, count: cookies.length });
}

export async function handleGetCookies(
  args: GetCookiesArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, urls } = args;
  const page = getPage(state, pageId);

  const cookies = urls ? await page.cookies(...urls) : await page.cookies();

  return respond({
    ok: true,
    action: 'cookies_retrieved',
    pageId,
    count: cookies.length,
    cookies: cookies as any,
  });
}

export async function handleDeleteCookies(
  args: DeleteCookiesArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, cookies } = args;
  const page = getPage(state, pageId);

  await page.deleteCookie(...cookies);

  return respond({ ok: true, action: 'cookies_deleted', pageId, count: cookies.length });
}
