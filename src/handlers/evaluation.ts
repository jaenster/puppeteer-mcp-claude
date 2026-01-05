import type { ServerState, MCPResponse, EvaluateArgs, WaitForSelectorArgs } from '../types';
import { getPage } from '../state';

/**
 * Execute JavaScript in the page context
 */
export async function handleEvaluate(
  args: EvaluateArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, script } = args;
  const page = getPage(state, pageId);

  const result = await page.evaluate(script);

  return {
    content: [{ type: 'text', text: `Script result: ${JSON.stringify(result)}` }],
  };
}

/**
 * Wait for a selector to appear
 */
export async function handleWaitForSelector(
  args: WaitForSelectorArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, selector, timeout = 30000 } = args;
  const page = getPage(state, pageId);

  await page.waitForSelector(selector, { timeout });

  return {
    content: [{ type: 'text', text: `Selector ${selector} appeared` }],
  };
}
