import { encode as toonEncode } from '@toon-format/toon';
import type { MCPContent, MCPResponse } from './types.js';

/**
 * Build an MCP tool response. The structured data is encoded as TOON text for
 * the wire (token-efficient, readable to the model) and also attached as
 * `structuredContent` so MCP clients that support it can consume it directly.
 *
 * TOON encoding throws on circular references; in that case we fall back to
 * a JSON-with-replacer string so the wire response always has *something*
 * usable instead of crashing the tool.
 *
 * Extra content blocks (e.g. images for screenshots) can be appended.
 */
export function respond(
  data: Record<string, unknown>,
  extra: MCPContent[] = []
): MCPResponse {
  let text: string;
  try {
    text = toonEncode(data as any);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    text = `<encode-error: ${msg}>\n${safeJsonStringify(data)}`;
  }
  return {
    content: [{ type: 'text', text }, ...extra],
    structuredContent: data,
  };
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    });
  } catch {
    return String(value);
  }
}
