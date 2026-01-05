import type { ServerState, MCPResponse, SelectorArgs, TypeArgs } from '../types';
import { getPage } from '../state';

/**
 * Click on an element
 */
export async function handleClick(
  args: SelectorArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, selector } = args;
  const page = getPage(state, pageId);

  await page.click(selector);

  return {
    content: [{ type: 'text', text: `Clicked on ${selector}` }],
  };
}

/**
 * Type text into an element
 */
export async function handleType(
  args: TypeArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, selector, text } = args;
  const page = getPage(state, pageId);

  await page.type(selector, text);

  return {
    content: [{ type: 'text', text: `Typed "${text}" into ${selector}` }],
  };
}

/**
 * Get text content from an element
 */
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

  return {
    content: [{ type: 'text', text: `Text from ${selector}: ${text}` }],
  };
}
