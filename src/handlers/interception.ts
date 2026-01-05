import type { ServerState, MCPResponse, SetRequestInterceptionArgs } from '../types';
import { getPage } from '../state';

/**
 * Enable request/response interception for a page
 */
export async function handleSetRequestInterception(
  args: SetRequestInterceptionArgs,
  state: ServerState
): Promise<MCPResponse> {
  const { pageId, enable = true, blockResources = [], modifyHeaders = {} } = args;
  const page = getPage(state, pageId);

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

  return {
    content: [
      {
        type: 'text',
        text: `Request interception ${enable ? 'enabled' : 'disabled'} for page ${pageId}`,
      },
    ],
  };
}
