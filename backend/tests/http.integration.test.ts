import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';
import { initializeDatabase, pool } from '../src/db/pool.js';

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const app = createApp();
const accept = 'application/json, text/event-stream';

type RpcResponse = { jsonrpc?: string; id?: string | number; result?: any; error?: { code?: number; message?: string } };
function parseRpc(response: { headers: Record<string, string | string[] | undefined>; text?: string; body?: unknown }, expectedId?: string | number): RpcResponse | null {
  const type = String(response.headers['content-type'] ?? '');
  if (type.includes('text/event-stream')) {
    const candidates: RpcResponse[] = [];
    const events = String(response.text ?? '').split(/\r?\n\r?\n/);
    for (const event of events) {
      const lines = event.split(/\r?\n/).filter((line) => line.startsWith('data:'));
      if (!lines.length) continue;
      try {
        const parsed = JSON.parse(lines.map((line) => line.slice(5).replace(/^ /, '')).join('\n')) as RpcResponse;
        if (expectedId !== undefined) {
          if (parsed?.id === expectedId && (parsed.result !== undefined || parsed.error !== undefined)) return parsed;
        } else if (parsed && parsed.id !== undefined && (parsed.result !== undefined || parsed.error !== undefined)) candidates.push(parsed);
      } catch { /* ignore non-JSON and heartbeat events */ }
    }
    return candidates.at(-1) ?? null;
  }
  if (response.body && typeof response.body === 'object' && Object.keys(response.body).length) return response.body as RpcResponse;
  if (response.text) {
    try { return JSON.parse(response.text) as RpcResponse; } catch { return null; }
  }
  return null;
}

describe('CORS same-origin behavior', () => {
  it('allows the production UI served from the API origin', async () => {
    const response = await request(app).options('/api/agent/chat')
      .set('Origin', 'http://127.0.0.1:8000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:8000');
  });
});

describe('Host-header validation', () => {
  it('allows a configured local host name', async () => {
    await request(app).get('/api/config').set('Host', 'localhost:8000').expect(200);
  });

  it('rejects an unlisted Host before serving application routes', async () => {
    const response = await request(app).get('/api/config').set('Host', 'attacker.example').expect(403);
    expect(response.body.code).toBe('HOST_DENIED');
  });
});

describe.skipIf(!databaseAvailable)('FixRelay HTTP and MCP integration', () => {
  beforeAll(async () => { await initializeDatabase(); });
  afterAll(async () => { await pool.end(); });

  it('reports API and PostgreSQL readiness without exposing secrets', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
    expect(JSON.stringify(response.body)).not.toContain('postgresql://');
  });

  it('serves typed dashboard data from persistent PostgreSQL records', async () => {
    const response = await request(app).get('/api/overview').expect(200);
    expect(typeof response.body.devices).toBe('number');
    expect(Array.isArray(response.body.recentCases)).toBe(true);
  });

  it('negotiates the required MCP protocol and lists the actual registered tools', async () => {
    const initialized = await request(app).post('/mcp')
      .set('Accept', accept).set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixrelay-http-test', version: '1.0.0' } } })
      .expect(200);
    const initBody = parseRpc(initialized, 1);
    expect(initBody?.result?.protocolVersion).toMatch(/^2025-11-25/);

    await request(app).post('/mcp')
      .set('Accept', accept).set('Content-Type', 'application/json').set('Mcp-Protocol-Version', '2025-11-25')
      .send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

    const listed = await request(app).post('/mcp')
      .set('Accept', accept).set('Content-Type', 'application/json').set('Mcp-Protocol-Version', '2025-11-25')
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
      .expect(200);
    const listBody = parseRpc(listed, 2);
    const names = (listBody?.result?.tools ?? []).map((tool: { name: string }) => tool.name);
    expect(names).toContain('search_devices');
    expect(names).toContain('evaluate_warranty');
    expect(names).toContain('create_repair_case');
    expect(names).toContain('add_case_note');
    expect(names).toHaveLength(8);
  });

  it('executes a real read-only MCP tool call and returns structured content', async () => {
    const result = await request(app).post('/mcp')
      .set('Accept', accept).set('Content-Type', 'application/json').set('Mcp-Protocol-Version', '2025-11-25')
      .send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_devices', arguments: { query: 'air purifier' } } })
      .expect(200);
    const body = parseRpc(result, 3);
    expect(body?.result?.isError).not.toBe(true);
    expect(body?.result?.content?.[0]?.text).toBeTruthy();
  });

  it('blocks an unlisted cross-origin request and rejects malformed JSON', async () => {
    await request(app).get('/api/health').set('Origin', 'https://unexpected.example').expect(403);
    await request(app).post('/api/devices').set('Content-Type', 'application/json').send('{bad json').expect(400);
  });
});
