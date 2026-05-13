import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decode as toonDecode } from '@toon-format/toon';
import { respond } from '../../src/response';

describe('respond()', () => {
  it('encodes plain data as TOON in content[0].text', () => {
    const r = respond({ ok: true, action: 'noop', count: 3 });
    const text = (r.content[0] as any).text;
    assert.equal(typeof text, 'string');
    const decoded = toonDecode(text);
    assert.deepEqual(decoded, { ok: true, action: 'noop', count: 3 });
  });

  it('attaches structuredContent matching the input', () => {
    const data = { ok: true, action: 'x', payload: [1, 2, 3] };
    const r = respond(data);
    assert.equal(r.structuredContent, data);
  });

  it('appends extra content blocks after the TOON text', () => {
    const r = respond({ ok: true }, [{ type: 'image', data: 'AAA', mimeType: 'image/png' }]);
    assert.equal(r.content.length, 2);
    assert.equal(r.content[0].type, 'text');
    assert.equal(r.content[1].type, 'image');
  });

  it('falls back gracefully when data has circular references', () => {
    const cycle: any = { ok: true };
    cycle.self = cycle;
    const r = respond(cycle);
    const text = (r.content[0] as any).text;
    assert.match(text, /encode-error/);
    assert.match(text, /\[Circular\]/);
    // structuredContent still carries the raw object for clients that want it
    assert.equal(r.structuredContent, cycle);
  });
});
