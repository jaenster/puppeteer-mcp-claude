import type { ServerState, MCPResponse, SetRequestInterceptionArgs } from '../types.js';
import { getPage } from '../state.js';
import { respond } from '../response.js';

export async function handleSetRequestInterception(
  args: SetRequestInterceptionArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, enable = true, blockResources = [], modifyHeaders = {} } = args;
  const page = getPage(state, pageId);

  // Drop any previous interception listeners — puppeteer will throw
  // "Request is already handled!" if a second handler tries to act on the
  // same request, which is exactly what happens if we just stack handlers.
  page.removeAllListeners('request');

  await page.setRequestInterception(enable);

  if (enable) {
    page.on('request', (request) => {
      const resourceType = request.resourceType();

      if (blockResources.includes(resourceType as any)) {
        request.abort();
        return;
      }

      const headers = { ...request.headers(), ...modifyHeaders };
      request.continue({ headers });
    });
  }

  return respond({
    ok: true,
    action: 'interception_configured',
    pageId,
    enabled: enable,
    blockedResources: blockResources,
    headerCount: Object.keys(modifyHeaders).length,
  });
}
