#!/usr/bin/env node
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { parseMcpPayload } from './mcp-response.js';

const baseUrl = (process.env.FIXRELAY_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const live = process.argv.includes('--execute');

function check(condition: boolean, label: string, detail: string): boolean {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}: ${detail}`);
  return condition;
}

async function parseMcpResponse(response: Response, expectedId?: string | number): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  return parseMcpPayload(text, response.headers.get('content-type') ?? '', expectedId);
}

async function postMcp(body: unknown, protocolVersion?: string, sessionId?: string): Promise<{ body: any; protocolVersion?: string; sessionId?: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (protocolVersion) headers['Mcp-Protocol-Version'] = protocolVersion;
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const response = await fetch(`${baseUrl}/mcp`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  const isNotification = !!body && typeof body === 'object' && !('id' in body) && typeof (body as { method?: unknown }).method === 'string' && String((body as { method: string }).method).startsWith('notifications/');
  const expectedId = body && typeof body === 'object' && 'id' in body ? (body as { id?: string | number }).id : undefined;
  const parsedBody = isNotification && (response.status === 202 || response.status === 204 || (response.ok && response.headers.get('content-length') === '0'))
    ? null
    : await parseMcpResponse(response, expectedId);
  return {
    body: parsedBody,
    ...(response.headers.get('mcp-protocol-version') ? { protocolVersion: response.headers.get('mcp-protocol-version')! } : {}),
    ...(response.headers.get('mcp-session-id') ? { sessionId: response.headers.get('mcp-session-id')! } : {}),
  };
}

async function verifyMcpReadOnlyPath(): Promise<{ tools: string[]; result: unknown }> {
  const initialized = await postMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixrelay-aws-verifier', version: '1.0.0' },
  } });
  if (initialized.body?.error) throw new Error(`MCP initialize failed: ${initialized.body.error.message ?? 'unknown error'}`);
  const version = String(initialized.body?.result?.protocolVersion ?? '');
  if (!version.startsWith('2025-11-25')) throw new Error(`Expected MCP protocol 2025-11-25 family, server negotiated ${version || '(missing)'}`);
  const sessionId = initialized.sessionId;
  const protocolVersion = initialized.protocolVersion ?? version;
  await postMcp({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, protocolVersion, sessionId);
  const list = await postMcp({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, protocolVersion, sessionId);
  if (list.body?.error) throw new Error(`tools/list failed: ${list.body.error.message ?? 'unknown error'}`);
  const tools = (list.body?.result?.tools ?? []).map((tool: { name?: unknown }) => String(tool.name ?? '')).filter(Boolean);
  if (!tools.includes('search_devices')) throw new Error('MCP server did not expose expected read-only search_devices tool.');
  const called = await postMcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_devices', arguments: { query: 'air purifier' } } }, protocolVersion, sessionId);
  if (called.body?.error) throw new Error(`tools/call failed: ${called.body.error.message ?? 'unknown error'}`);
  if (called.body?.result?.isError) throw new Error('search_devices returned an MCP tool error.');
  return { tools, result: called.body?.result };
}

async function main() {
  console.log('FixRelay live AWS preflight');
  console.log(`Target: ${baseUrl}`);
  let success = true;
  success = check(process.env.AI_PROVIDER === 'bedrock', 'AI_PROVIDER', `must equal "bedrock" (currently ${process.env.AI_PROVIDER ?? 'unset'})`) && success;
  success = check(!!process.env.AWS_REGION, 'AWS_REGION', process.env.AWS_REGION ?? 'not configured') && success;
  success = check(!!process.env.BEDROCK_MODEL_ID, 'BEDROCK_MODEL_ID', process.env.BEDROCK_MODEL_ID ?? 'not configured') && success;
  success = check(!!process.env.DATABASE_URL, 'DATABASE_URL', process.env.DATABASE_URL ? 'configured (value not printed)' : 'not configured') && success;

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5_000) });
    const health = await healthResponse.json() as Record<string, unknown>;
    success = check(healthResponse.ok && health.status === 'ok' && health.database === 'connected', 'FixRelay API and PostgreSQL', JSON.stringify({ status: health.status, database: health.database })) && success;
  } catch (error) {
    success = check(false, 'FixRelay API and PostgreSQL', error instanceof Error ? error.message : 'unreachable') && success;
  }

  let mcp: { tools: string[]; result: unknown } | undefined;
  try {
    mcp = await verifyMcpReadOnlyPath();
    success = check(true, 'MCP protocol and real tool call', `negotiated 2025-11-25; discovered ${mcp.tools.length} tools; search_devices executed`) && success;
  } catch (error) {
    success = check(false, 'MCP protocol and real tool call', error instanceof Error ? error.message : 'failed') && success;
  }

  if (!live) {
    console.log('\nPreflight mode only; no Bedrock inference was made.');
    console.log('Run `npm run aws:verify` to explicitly execute one potentially billable Bedrock-backed agent request after all checks pass.');
    if (!success) process.exitCode = 1;
    return;
  }

  if (!success || !mcp) {
    console.error('\nPreconditions failed. Fix them before making a billable Bedrock request.');
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const confirmation = await rl.question('This will make one potentially billable Amazon Bedrock request. Continue? Type YES: ');
  rl.close();
  if (confirmation !== 'YES') {
    console.log('Cancelled; no Bedrock request was made.');
    return;
  }

  try {
    const { runBedrockAgent } = await import('../src/ai/agent.js');
    const invocationStarted = new Date();
    const verificationSession = `session_awsverify_${Date.now()}`;
    const result = await runBedrockAgent('Use the read-only search_devices tool to find the air purifier in the FixRelay demo inventory. Summarize the returned facts and clearly identify any synthetic/demo data. Do not create or modify anything.', verificationSession);
    const authentic = result.provider === 'bedrock' && !!result.modelId && !!result.answer.trim();
    success = check(authentic, 'Live Bedrock + Strands agent', `provider=${result.provider}; model=${result.modelId}; non-empty response=${!!result.answer.trim()}`) && success;
    const { pool } = await import('../src/db/pool.js');
    const toolTrace = await pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs WHERE tool_name = 'search_devices' AND success = TRUE AND created_at >= $1`,
      [invocationStarted],
    );
    const observedAgentToolCall = Number(toolTrace.rows[0]?.count ?? 0) > 0;
    success = check(observedAgentToolCall, 'Agent-to-MCP tool trace', observedAgentToolCall ? 'a successful search_devices audit record was observed during the Bedrock invocation' : 'no successful search_devices audit record was observed; verify the agent actually used the MCP tool') && success;
    if (authentic) console.log(`Agent response preview: ${result.answer.slice(0, 500).replace(/\s+/g, ' ')}`);
    await pool.end();
  } catch (error) {
    success = check(false, 'Live Bedrock + Strands agent', error instanceof Error ? error.message : 'request failed') && success;
    try { const { pool } = await import('../src/db/pool.js'); await pool.end(); } catch { /* Nothing to close if initialization failed. */ }
  }
  if (!success) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'AWS verification failed.');
  process.exitCode = 1;
});
