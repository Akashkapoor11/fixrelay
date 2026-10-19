import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { fixRelayService, ServiceError } from '../domain/service.js';

const textResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

async function safeTool<T>(name: string, args: Record<string, unknown>, work: () => Promise<T> | T) {
  try {
    const result = await work();
    await fixRelayService.writeAudit(name, args, true);
    return textResult(result);
  } catch (error) {
    const code = error instanceof ServiceError ? error.code : 'TOOL_FAILED';
    if (!(error instanceof ServiceError)) {
      console.error(JSON.stringify({ level: 'error', message: 'mcp_tool_failed', toolName: name, errorType: error instanceof Error ? error.name : 'Unknown' }));
    }
    await fixRelayService.writeAudit(name, args, false, code);
    const publicMessage = error instanceof ServiceError
      ? error.message
      : 'The tool could not complete because of an unexpected server error. Check server logs using the request timestamp.';
    return { content: [{ type: 'text' as const, text: publicMessage }], isError: true };
  }
}

export function createFixRelayMcpServer() {
  const server = new McpServer({ name: 'fixrelay', version: '2.0.0' }, { capabilities: { tools: {} } });

  server.registerTool('search_devices', {
    title: 'Search device inventory',
    description: 'Search FixRelay local device records by name, model, category, serial number or room.',
    inputSchema: z.object({ query: z.string().trim().max(160).optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ query }) => safeTool('search_devices', { query: query ?? '' }, () => fixRelayService.listDevices(query ?? '')));

  server.registerTool('get_device', {
    title: 'Get device details',
    description: 'Return a specific device record by its exact FixRelay device ID.',
    inputSchema: z.object({ deviceId: z.string().min(1).max(160) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ deviceId }) => safeTool('get_device', { deviceId }, async () => {
    const device = await fixRelayService.getDevice(deviceId);
    if (!device) throw new ServiceError('Device not found.', 404, 'DEVICE_NOT_FOUND');
    return device;
  }));

  server.registerTool('search_manual', {
    title: 'Search product reference excerpts',
    description: 'Search source-labelled manual/reference excerpts. Some demo excerpts are synthetic or user-provided and must not be represented as verified manufacturer documentation.',
    inputSchema: z.object({ query: z.string().trim().min(1).max(240), deviceId: z.string().max(160).optional() }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ query, deviceId }) => safeTool('search_manual', { query, deviceId }, () => fixRelayService.searchManuals(query, deviceId)));

  server.registerTool('evaluate_warranty', {
    title: 'Calculate warranty date window',
    description: 'Calculate a warranty expiry date from the saved purchase date and duration; this does not establish real manufacturer coverage or claim eligibility.',
    inputSchema: z.object({ deviceId: z.string().min(1).max(160) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ deviceId }) => safeTool('evaluate_warranty', { deviceId }, () => fixRelayService.warrantyForDevice(deviceId)));

  server.registerTool('find_service_options', {
    title: 'Prepare service next steps',
    description: 'Return illustrative next-step options only. This tool does not search live providers, contact a provider, book an appointment or make a purchase.',
    inputSchema: z.object({ issue: z.string().trim().min(4).max(1200) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ issue }) => safeTool('find_service_options', { issue }, async () => fixRelayService.findServiceOptions(issue)));

  server.registerTool('create_repair_case', {
    title: 'Create an approved local repair-case draft',
    description: 'Create a local-only repair-case draft using a valid, unused, short-lived approval token explicitly issued after user confirmation. Never call this tool without explicit approval and the matching token. No provider is contacted.',
    inputSchema: z.object({
      deviceId: z.string().min(1).max(160), issue: z.string().min(4).max(1200),
      summary: z.string().trim().min(1).max(800), sessionId: z.string().min(8).max(120),
      approvalToken: z.string().min(20).max(200),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, async (input) => safeTool('create_repair_case', { deviceId: input.deviceId, issue: input.issue, sessionId: input.sessionId, approvalToken: '[REDACTED]' }, () => fixRelayService.createCase(input)));

  server.registerTool('get_case_status', {
    title: 'Get repair-case status and history',
    description: 'Retrieve a saved local repair case and its event history by case ID.',
    inputSchema: z.object({ caseId: z.string().min(1).max(160) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ caseId }) => safeTool('get_case_status', { caseId }, async () => {
    const record = await fixRelayService.getCase(caseId);
    if (!record) throw new ServiceError('Repair case not found.', 404, 'CASE_NOT_FOUND');
    return record;
  }));

  server.registerTool('add_case_note', {
    title: 'Add a note to a local repair case',
    description: 'Append a note only when the user explicitly requests that exact note for an identified local case, then update its timestamp. This changes only FixRelay local records; no provider is contacted.',
    inputSchema: z.object({ caseId: z.string().min(1).max(160), note: z.string().trim().min(2).max(1200) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  }, async ({ caseId, note }) => safeTool('add_case_note', { caseId, note }, () => fixRelayService.addCaseNote(caseId, note)));

  return server;
}

export const mcpHandler = createMcpHandler(createFixRelayMcpServer);
