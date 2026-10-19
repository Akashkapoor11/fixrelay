import { describe, expect, it } from 'vitest';
import { parseMcpPayload } from '../scripts/mcp-response.js';
import { isAcceptedNoContentNotification } from '../../frontend/src/lib/api.js';

describe('AWS verification MCP response parsing', () => {
  it('selects the matching JSON-RPC result after unrelated SSE notifications', () => {
    const stream = [
      'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":0.5}}',
      'event: message\ndata: {"jsonrpc":"2.0",\ndata: "id":3,"result":{"ok":true}}',
    ].join('\n\n');
    expect(parseMcpPayload(stream, 'text/event-stream', 3)).toEqual({ jsonrpc: '2.0', id: 3, result: { ok: true } });
  });

  it('rejects event streams without a matching request ID', () => {
    const stream = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{}}\n\n';
    expect(() => parseMcpPayload(stream, 'text/event-stream', 3)).toThrow(/response for id 3/);
  });

  it('validates JSON response envelope and rejects unsupported content types', () => {
    expect(parseMcpPayload('{"jsonrpc":"2.0","id":4,"result":{}}', 'application/json', 4)).toEqual({ jsonrpc: '2.0', id: 4, result: {} });
    expect(() => parseMcpPayload('{"jsonrpc":"2.0","id":5,"result":{}}', 'application/json', 4)).toThrow(/id 4/);
    expect(() => parseMcpPayload('ok', 'text/plain')).toThrow(/Unsupported/);
  });
});


describe('browser MCP notification handling', () => {
  it('accepts empty HTTP 202 and 204 responses for JSON-RPC notifications', () => {
    const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
    expect(isAcceptedNoContentNotification(notification, 202)).toBe(true);
    expect(isAcceptedNoContentNotification(notification, 204)).toBe(true);
    expect(isAcceptedNoContentNotification(notification, 200, '0')).toBe(true);
  });

  it('does not accept empty responses for requests or arbitrary JSON-RPC messages', () => {
    expect(isAcceptedNoContentNotification({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 202)).toBe(false);
    expect(isAcceptedNoContentNotification({ jsonrpc: '2.0', method: 'not-a-notification' }, 202)).toBe(false);
    expect(isAcceptedNoContentNotification(null, 204)).toBe(false);
  });
});
