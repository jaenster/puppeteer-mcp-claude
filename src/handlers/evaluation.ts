import type { ServerState, MCPResponse, EvaluateArgs, WaitForSelectorArgs } from '../types.js';
import { getPage } from '../state.js';
import { respond } from '../response.js';

export async function handleEvaluate(
  args: EvaluateArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, script } = args;
  const page = getPage(state, pageId);

  const result = await page.evaluate(script);

  return respond({ ok: true, action: 'evaluated', pageId, result: result as any });
}

export async function handleWaitForSelector(
  args: WaitForSelectorArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, selector, timeout = 30000 } = args;
  const page = getPage(state, pageId);

  await page.waitForSelector(selector, { timeout });

  return respond({ ok: true, action: 'selector_appeared', pageId, selector });
}
