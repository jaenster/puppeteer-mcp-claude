import type { ServerState, MCPResponse, SelectorArgs, TypeArgs } from '../types.js';
import { getPage } from '../state.js';
import { respond } from '../response.js';

export async function handleClick(
  args: SelectorArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, selector } = args;
  const page = getPage(state, pageId);

  await page.click(selector);

  return respond({ ok: true, action: 'clicked', pageId, selector });
}

export async function handleType(
  args: TypeArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, selector, text } = args;
  const page = getPage(state, pageId);

  await page.type(selector, text);

  return respond({ ok: true, action: 'typed', pageId, selector, text });
}

export async function handleGetText(
  args: SelectorArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, selector } = args;
  const page = getPage(state, pageId);

  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element ${selector} not found`);
  }

  const text = await page.evaluate((el) => el.textContent, element);

  return respond({ ok: true, action: 'text_extracted', pageId, selector, text });
}
