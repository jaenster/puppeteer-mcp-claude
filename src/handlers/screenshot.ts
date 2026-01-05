import type { ServerState, MCPResponse, ScreenshotArgs } from '../types';
import { getPage } from '../state';

/**
 * Take a screenshot of the page
 */
export async function handleScreenshot(
  args: ScreenshotArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, path, fullPage = false } = args;
  const page = getPage(state, pageId);

  await page.screenshot({
    path,
    fullPage,
    type: 'png',
  });

  return {
    content: [
      {
        type: 'text',
        text: path ? `Screenshot saved to ${path}` : 'Screenshot taken',
      },
    ],
  };
}
