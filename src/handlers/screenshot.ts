import type { ServerState, MCPResponse, ScreenshotArgs } from '../types.js';
import { getPage } from '../state.js';
import { respond } from '../response.js';

export async function handleScreenshot(
  args: ScreenshotArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, path, fullPage = false } = args;
  const page = getPage(state, pageId);

  const bytes = await page.screenshot({
    path,
    fullPage,
    type: 'png',
  });

  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes as Uint8Array);
  const data = buffer.toString('base64');

  return respond(
    {
      ok: true,
      action: 'screenshot_taken',
      pageId,
      path: path ?? null,
      fullPage,
      bytes: buffer.length,
    },
    [{ type: 'image', data, mimeType: 'image/png' }]
  );
}
