export interface Device {
  id: string; name: string; brand: string; category: string; model: string; serialNumber: string;
  purchaseDate: string; warrantyMonths: number; room: string; condition: string; createdAt: string;
}
export interface Evidence {
  id: string; deviceId: string; title: string; section: string; excerpt: string; sourceLabel: string;
  sourceNote: string; sourceUrl: string; safetyLevel: 'low' | 'medium' | 'high'; keywords: string; createdAt: string; verified: boolean;
}
export interface Warranty {
  purchaseDate: string; warrantyMonths: number; calculatedExpiryDate: string;
  state: 'Active by recorded dates' | 'Expired by recorded dates' | 'No warranty recorded';
  daysRemaining: number; disclaimer: string;
}
export interface ServiceOption {
  id: string; label: string; description: string; estimatedResponse: string;
  type: 'self-check' | 'support' | 'qualified-service'; illustrative: true;
}
export interface RepairCase {
  id: string; deviceId: string; deviceName: string; issue: string; status: string; severity: string;
  warrantyState: string; summary: string; resolution: string; createdAt: string; updatedAt: string; approvedAt: string;
  sessionId: string; events?: CaseEvent[];
}
export interface CaseEvent { id: string; caseId: string; kind: string; title: string; detail: string; createdAt: string; }
export interface Investigation {
  sessionId: string; query: string; issue: string; device: Device | null; evidence: Evidence[];
  warranty: Warranty | null; serviceOptions: ServiceOption[]; severity: string; safetyGuidance: string[];
  recommendedNextSteps: string[]; trace: Array<{ step: string; status: 'complete' | 'warning'; detail: string }>;
  disclaimer: string;
}
export interface Dashboard {
  devices: number; openCases: number; highPriority: number; activeWarranty: number;
  recentCases: RepairCase[]; latestEvents: CaseEvent[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers });
  const data = await response.json().catch(() => ({})) as T & { error?: string; code?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request<{ status: string; service: string; database: string; aiProvider: 'demo' | 'bedrock' }>('/api/health'),
  config: () => request<{ aiProvider: 'demo' | 'bedrock'; mcpEndpoint: string; protocolFamily: string }>('/api/config'),
  overview: () => request<Dashboard>('/api/overview'),
  devices: (search = '') => request<{ devices: Device[] }>(`/api/devices${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  addDevice: (payload: Record<string, unknown>) => request<{ device: Device }>('/api/devices', json(payload)),
  cases: () => request<{ cases: RepairCase[] }>('/api/cases'),
  getCase: (id: string) => request<{ case: RepairCase }>(`/api/cases/${encodeURIComponent(id)}`),
  investigate: (payload: { deviceQuery: string; issue: string; sessionId: string }) => request<Investigation>('/api/investigations', json(payload)),
  requestApproval: (payload: { deviceId: string; issue: string; summary: string; sessionId: string }) => request<{ approvalToken: string; expiresAt: string }>('/api/approvals', json(payload)),
  createCase: (payload: { deviceId: string; issue: string; summary: string; sessionId: string; approvalToken: string }) => request<{ case: RepairCase }>('/api/cases', json(payload)),
  agentChat: (payload: { prompt: string; sessionId: string }) => request<{ provider: string; answer: string; investigation?: Investigation }>('/api/agent/chat', json(payload)),
};

function parseMcpEventStream(text: string, expectedId?: string | number): unknown {
  const matches: unknown[] = [];
  for (const event of text.split(/\r?\n\r?\n/)) {
    const dataLines = event.split(/\r?\n/).filter((line) => line.startsWith('data:'));
    if (!dataLines.length) continue;
    const payloadText = dataLines.map((line) => line.slice(5).replace(/^ /, '')).join('\n').trim();
    if (!payloadText || payloadText === '[DONE]') continue;
    try {
      const payload: unknown = JSON.parse(payloadText);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
      const envelope = payload as Record<string, unknown>;
      if (expectedId !== undefined) {
        if (envelope.id === expectedId && ('result' in envelope || 'error' in envelope)) return payload;
      } else if ('id' in envelope && ('result' in envelope || 'error' in envelope)) {
        matches.push(payload);
      }
    } catch { /* Ignore heartbeats and non-JSON SSE frames. */ }
  }
  if (expectedId !== undefined) throw new Error(`MCP event stream did not contain a JSON-RPC response for id ${String(expectedId)}.`);
  if (matches.length) return matches[matches.length - 1];
  throw new Error('MCP event stream did not contain a JSON-RPC result or error.');
}

export function isAcceptedNoContentNotification(message: unknown, status: number, contentLength?: string | null): boolean {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
  const envelope = message as Record<string, unknown>;
  const notification = envelope.jsonrpc === '2.0' && typeof envelope.method === 'string'
    && envelope.method.startsWith('notifications/') && !('id' in envelope);
  return notification && (status === 202 || status === 204 || contentLength === '0');
}

async function mcpPost(message: unknown, version?: string, sessionId?: string): Promise<{ body: any; version: string; sessionId?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (version) headers['Mcp-Protocol-Version'] = version;
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const response = await fetch('/mcp', { method: 'POST', headers, body: JSON.stringify(message) });
  const responseSession = response.headers.get('mcp-session-id') ?? sessionId;
  const responseVersion = response.headers.get('mcp-protocol-version') ?? version ?? '2025-11-25';
  const contentType = response.headers.get('content-type') ?? '';
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const expectedId = message && typeof message === 'object' && 'id' in message
    ? (message as { id?: string | number }).id : undefined;
  const notificationAcceptedWithoutBody = isAcceptedNoContentNotification(message, response.status, response.headers.get('content-length')) && response.ok;
  let body: any = null;
  if (!notificationAcceptedWithoutBody && mediaType === 'text/event-stream') {
    body = parseMcpEventStream(await response.text(), expectedId);
  } else if (!notificationAcceptedWithoutBody && mediaType === 'application/json') {
    body = await response.json().catch(() => null);
  } else if (!notificationAcceptedWithoutBody) {
    throw new Error(`Unsupported MCP response content type: ${contentType || '(missing)'}`);
  }
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error ?? `MCP HTTP ${response.status}`);
  if (expectedId !== undefined) {
    if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0' || body.id !== expectedId || (!('result' in body) && !('error' in body))) {
      throw new Error(`MCP JSON-RPC response did not match request id ${String(expectedId)}.`);
    }
  }
  return { body, version: responseVersion, ...(responseSession ? { sessionId: responseSession } : {}) };
}

export async function inspectMcp(toolName: string, args: Record<string, unknown>) {
  const init = await mcpPost({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixrelay-browser-mcp-client', version: '2.0.0' } },
  });
  if (init.body?.error) throw new Error(init.body.error.message ?? 'MCP initialization failed.');
  const version = String(init.body?.result?.protocolVersion ?? '');
  if (!version.startsWith('2025-11-25')) throw new Error(`Expected MCP protocol 2025-11-25 family, received ${version || '(missing)'}.`);
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' }, version, init.sessionId);
  const listed = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, version, init.sessionId);
  if (listed.body?.error) throw new Error(listed.body.error.message ?? 'MCP tools/list failed.');
  const called = await mcpPost({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: toolName, arguments: args } }, version, init.sessionId);
  if (called.body?.error) throw new Error(called.body.error.message ?? 'MCP tools/call failed.');
  if (called.body?.result?.isError) throw new Error(called.body.result.content?.map((part: any) => part.text).join('\n') ?? 'MCP tool returned an error.');
  return { protocolVersion: version, tools: listed.body?.result?.tools ?? [], result: called.body?.result ?? null };
}
