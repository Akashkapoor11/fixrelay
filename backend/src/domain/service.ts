import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, newId, withTransaction } from '../db/pool.js';
import {
  addMonths, detectSeverity, evaluateWarranty, hashApprovalDraft, hashIssue, hashToken, inferSafetyLevel,
  mintApprovalToken, normalizeReferenceUrl, normalizeText, safetyGuidance, serviceRecommendations, tokenize,
} from './logic.js';
import type { CaseEvent, DashboardData, Device, Investigation, ManualEvidence, RepairCase, ServiceOption, Severity, WarrantyEvaluation } from './types.js';

export class ServiceError extends Error {
  constructor(message: string, public readonly statusCode = 400, public readonly code = 'BAD_REQUEST') {
    super(message);
    this.name = 'ServiceError';
  }
}

const DeviceInput = z.object({
  name: z.string().trim().min(1).max(100),
  brand: z.string().trim().max(100).optional().default('User-entered brand'),
  category: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(100),
  serialNumber: z.string().trim().max(100).optional().default(''),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Purchase date must use YYYY-MM-DD.'),
  warrantyMonths: z.number().int().min(0).max(120),
  room: z.string().trim().max(100).optional().default('Not specified'),
  condition: z.string().trim().max(100).optional().default('Needs attention'),
  referenceTitle: z.string().trim().max(160).optional(),
  referenceSection: z.string().trim().max(160).optional(),
  referenceExcerpt: z.string().trim().max(8000).optional(),
  referenceUrl: z.string().trim().max(2048).optional().default(''),
});

const SessionId = z.string().trim().min(8).max(120).regex(/^[a-zA-Z0-9._:-]+$/);
const IssueInput = z.string().trim().min(4).max(1200);

function stringDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}
function isoDateTime(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
function mapDevice(row: Record<string, unknown>): Device {
  return {
    id: String(row.id), name: String(row.name), brand: String(row.brand), category: String(row.category),
    model: String(row.model), serialNumber: String(row.serial_number ?? ''), purchaseDate: stringDate(row.purchase_date),
    warrantyMonths: Number(row.warranty_months), room: String(row.room), condition: String(row.condition), createdAt: isoDateTime(row.created_at),
  };
}
function mapManual(row: Record<string, unknown>): ManualEvidence {
  const sourceLabel = String(row.source_label ?? 'Unknown source');
  const sourceNote = String(row.source_note ?? 'Source notes are unavailable.');
  return {
    id: String(row.id), deviceId: String(row.device_id), title: String(row.title), section: String(row.section),
    excerpt: String(row.excerpt), sourceLabel, sourceNote, sourceUrl: String(row.source_url ?? ''), safetyLevel: row.safety_level as ManualEvidence['safetyLevel'],
    keywords: String(row.keywords ?? ''), createdAt: isoDateTime(row.created_at),
    // Verification is an explicit database flag, never inferred from a source label.
    verified: row.verified === true,
  };
}
function mapCase(row: Record<string, unknown>): RepairCase {
  return {
    id: String(row.id), deviceId: String(row.device_id), deviceName: String(row.device_name ?? 'Unknown device'),
    issue: String(row.issue), status: row.status as RepairCase['status'], severity: row.severity as Severity,
    warrantyState: String(row.warranty_state), summary: String(row.summary), resolution: String(row.resolution),
    createdAt: isoDateTime(row.created_at), updatedAt: isoDateTime(row.updated_at),
    approvedAt: isoDateTime(row.approved_at), sessionId: String(row.session_id),
  };
}
function mapEvent(row: Record<string, unknown>): CaseEvent {
  return { id: String(row.id), caseId: String(row.case_id), kind: String(row.kind), title: String(row.title), detail: String(row.detail), createdAt: isoDateTime(row.created_at) };
}
function scoreDevice(device: Device, query: string): number {
  const terms = tokenize(query);
  if (!terms.length) return 0;
  const name = device.name.toLowerCase();
  const haystack = `${device.name} ${device.brand} ${device.category} ${device.model} ${device.serialNumber} ${device.room}`.toLowerCase();
  return terms.reduce((score, term) => score + (name.includes(term) ? 3 : haystack.includes(term) ? 1 : 0), 0);
}
function makeServiceOptions(issue: string): ServiceOption[] {
  const severity = detectSeverity(issue);
  const highRisk = severity === 'high' || severity === 'urgent';
  const options: ServiceOption[] = [{
    id: 'option-manual-review', label: 'Review safety guidance against official sources',
    description: 'Compare the evidence shown in FixRelay with the actual model-specific documentation.',
    estimatedResponse: 'Immediate self-review', type: 'self-check', illustrative: true,
  }];
  if (!highRisk) options.push({
    id: 'option-support', label: 'Check official product support options',
    description: 'Use the contact details printed in your real product documentation or on the manufacturer’s official website.',
    estimatedResponse: 'Varies by provider', type: 'support', illustrative: true,
  });
  options.push({
    id: 'option-qualified-service', label: 'Seek a qualified repair assessment',
    description: 'Confirm qualifications, model compatibility, price, warranty effects and availability directly before agreeing to work.',
    estimatedResponse: 'Must be confirmed directly', type: 'qualified-service', illustrative: true,
  });
  return options;
}

export class FixRelayService {
  async listDevices(query = ''): Promise<Device[]> {
    const { rows } = await pool.query('SELECT * FROM devices ORDER BY name ASC LIMIT 200');
    const devices = rows.map((row) => mapDevice(row as Record<string, unknown>));
    if (!query.trim()) return devices;
    return devices.map((device) => ({ device, score: scoreDevice(device, query) }))
      .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.device.name.localeCompare(b.device.name))
      .map((entry) => entry.device);
  }

  async getDevice(id: string): Promise<Device | null> {
    const { rows } = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    return rows[0] ? mapDevice(rows[0] as Record<string, unknown>) : null;
  }

  async addDevice(input: unknown): Promise<Device> {
    const parsed = DeviceInput.safeParse(input);
    if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? 'Device details are invalid.');
    const data = parsed.data;
    let safeReferenceUrl = '';
    try { safeReferenceUrl = normalizeReferenceUrl(data.referenceUrl); }
    catch { throw new ServiceError('Reference URL must be a valid HTTP(S) URL without embedded credentials.'); }
    if (data.referenceUrl && !data.referenceExcerpt) {
      throw new ServiceError('Add a short excerpt with the reference URL so the source can be reviewed in context.');
    }
    const purchase = new Date(`${data.purchaseDate}T00:00:00.000Z`);
    if (Number.isNaN(purchase.getTime()) || purchase.toISOString().slice(0, 10) !== data.purchaseDate) throw new ServiceError('Purchase date is invalid.');
    if (data.purchaseDate > new Date().toISOString().slice(0, 10)) throw new ServiceError('Purchase date cannot be in the future.');
    const id = newId('device');
    const device = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO devices (id,name,brand,category,model,serial_number,purchase_date,warranty_months,room,condition)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [id, data.name, data.brand, data.category, data.model, data.serialNumber, data.purchaseDate, data.warrantyMonths, data.room, data.condition],
      );
      if (data.referenceExcerpt) {
        await client.query(
          `INSERT INTO manuals (id,device_id,title,section,excerpt,source_label,source_note,source_url,safety_level,keywords)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [newId('evidence'), id, data.referenceTitle || `${data.name} · User-provided reference`, data.referenceSection || 'User-provided excerpt', data.referenceExcerpt,
            'User-provided reference', safeReferenceUrl
              ? 'URL supplied by the user; not independently verified by FixRelay. Confirm the actual product model, publisher, revision and safety instructions before acting.'
              : 'No source URL supplied. Excerpt is not independently verified by FixRelay; confirm against real manufacturer documentation.',
            safeReferenceUrl, inferSafetyLevel(data.referenceExcerpt), tokenize(data.referenceExcerpt).join(' ')],
        );
      }
      return mapDevice(rows[0] as Record<string, unknown>);
    });
    return device;
  }

  async searchManuals(query: string, deviceId?: string): Promise<ManualEvidence[]> {
    const terms = tokenize(query);
    // Do not return unrelated recent excerpts when a generic query reduces to stop words.
    if (!terms.length) return [];
    const { rows } = await pool.query(
      `SELECT m.*, ts_rank(
         to_tsvector('english', m.title || ' ' || m.section || ' ' || m.excerpt || ' ' || m.keywords),
         plainto_tsquery('english', $2)
       ) AS relevance
       FROM manuals AS m
       WHERE ($1::text IS NULL OR m.device_id = $1)
         AND to_tsvector('english', m.title || ' ' || m.section || ' ' || m.excerpt || ' ' || m.keywords)
             @@ plainto_tsquery('english', $2)
       ORDER BY relevance DESC, m.created_at DESC
       LIMIT 5`,
      [deviceId ?? null, terms.join(' ')],
    );
    return rows.map((row) => mapManual(row as Record<string, unknown>));
  }

  findServiceOptions(issue: string): ServiceOption[] {
    const parsed = IssueInput.parse(issue);
    return makeServiceOptions(parsed);
  }

  async warrantyForDevice(deviceId: string): Promise<WarrantyEvaluation> {
    const device = await this.getDevice(deviceId);
    if (!device) throw new ServiceError('Device not found.', 404, 'DEVICE_NOT_FOUND');
    return evaluateWarranty(device.purchaseDate, device.warrantyMonths);
  }

  async investigate(input: { deviceQuery: string; issue: string; sessionId?: string }): Promise<Investigation> {
    const deviceQuery = normalizeText(input.deviceQuery);
    const issue = normalizeText(input.issue);
    const parsedIssue = IssueInput.safeParse(issue);
    if (!parsedIssue.success) throw new ServiceError('Describe the issue in at least four characters and no more than 1,200 characters.');
    const sessionId = SessionId.parse(input.sessionId ?? `session_${randomUUID()}`);
    const candidateQuery = deviceQuery || issue;
    const matches = await this.listDevices(candidateQuery);
    const device = matches[0] ?? null;
    const evidence = await this.searchManuals(issue, device?.id);
    const warranty = device ? evaluateWarranty(device.purchaseDate, device.warrantyMonths) : null;
    const severity = detectSeverity(issue);
    const trace: Investigation['trace'] = [
      { step: 'Device matching', status: device ? 'complete' : 'warning', detail: device ? `Matched ${device.name} from the local inventory.` : 'No inventory match; recommendations remain generic.' },
      { step: 'Evidence retrieval', status: evidence.length ? 'complete' : 'warning', detail: evidence.length ? `Retrieved ${evidence.length} source-labelled excerpt(s).` : 'No relevant excerpt found; no unsupported manual claim is made.' },
      { step: 'Warranty calculation', status: warranty ? 'complete' : 'warning', detail: warranty ? `Calculated date window ending ${warranty.calculatedExpiryDate}.` : 'A purchase date and warranty duration are needed to calculate a date window.' },
      { step: 'Service planning', status: 'complete', detail: 'Prepared illustrative next-step options only; no provider was contacted.' },
    ];
    const investigation: Investigation = {
      sessionId, query: deviceQuery, issue, device, evidence, warranty, serviceOptions: makeServiceOptions(issue), severity,
      safetyGuidance: safetyGuidance(issue), recommendedNextSteps: serviceRecommendations(issue), trace,
      disclaimer: 'FixRelay is a demonstration workflow. Evidence can be synthetic or user-provided and may be unverified. Warranty state is date arithmetic, not a coverage decision. No service provider is contacted and no booking or purchase occurs.',
    };
    const userTurn = deviceQuery && deviceQuery !== issue ? `Device requested: ${deviceQuery}\nIssue described: ${issue}` : issue;
    const assistantTurn = [
      device ? `Matched device: ${device.name} (${device.model}).` : 'No device matched the request.',
      evidence.length ? `Evidence retrieved: ${evidence.map((item) => `${item.title} [${item.verified ? 'source flag marked verified' : 'synthetic/user-provided or otherwise unverified'}]`).join('; ')}.` : 'No matching reference excerpt was found.',
      warranty ? `Warranty date arithmetic: ${warranty.state}; calculated expiry ${warranty.calculatedExpiryDate}.` : 'Warranty calculation unavailable without a matched device.',
      `Severity: ${severity}. Safety guidance: ${investigation.safetyGuidance.join(' ')}`,
      'No external service was contacted, and no booking or purchase occurred.',
    ].join(' ');
    await pool.query('INSERT INTO conversation_messages (id,session_id,role,content) VALUES ($1,$2,$3,$4)',
      [newId('message'), sessionId, 'user', userTurn.slice(0, 1600)]);
    await pool.query('INSERT INTO conversation_messages (id,session_id,role,content) VALUES ($1,$2,$3,$4)',
      [newId('message'), sessionId, 'assistant', assistantTurn.slice(0, 12000)]);
    return investigation;
  }

  async createApproval(input: { deviceId: string; issue: string; summary: string; sessionId: string }): Promise<{ approvalToken: string; expiresAt: string }> {
    const deviceId = normalizeText(input.deviceId);
    const issue = IssueInput.parse(input.issue);
    const summary = normalizeText(input.summary);
    if (!summary || summary.length > 800) throw new ServiceError('Case summary is required and must be 800 characters or fewer.');
    const sessionId = SessionId.parse(input.sessionId);
    if (!await this.getDevice(deviceId)) throw new ServiceError('Device not found.', 404, 'DEVICE_NOT_FOUND');
    const token = mintApprovalToken();
    const configuredTtl = Number(process.env.APPROVAL_TTL_SECONDS ?? 180);
    const ttlSeconds = Number.isFinite(configuredTtl) ? Math.max(30, Math.min(600, configuredTtl)) : 180;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await pool.query(
      `INSERT INTO approval_tokens (token_hash,device_id,issue_hash,draft_hash,session_id,expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [hashToken(token), deviceId, hashIssue(issue), hashApprovalDraft({ deviceId, issue, summary, sessionId }), sessionId, expiresAt],
    );
    return { approvalToken: token, expiresAt };
  }

  async createCase(input: { deviceId: string; issue: string; summary: string; sessionId: string; approvalToken: string }): Promise<RepairCase> {
    const issue = IssueInput.parse(input.issue);
    const summary = normalizeText(input.summary);
    if (!summary || summary.length > 800) throw new ServiceError('Case summary is required and must be 800 characters or fewer.');
    if (!input.approvalToken || input.approvalToken.length < 20 || input.approvalToken.length > 200) throw new ServiceError('A valid approval token is required.', 403, 'APPROVAL_REQUIRED');
    const deviceId = normalizeText(input.deviceId);
    const sessionId = SessionId.parse(input.sessionId);
    const result = await withTransaction(async (client) => {
      const tokenResult = await client.query(
        `SELECT * FROM approval_tokens WHERE token_hash = $1 FOR UPDATE`, [hashToken(input.approvalToken)],
      );
      const approval = tokenResult.rows[0] as Record<string, unknown> | undefined;
      const valid = approval && approval.consumed_at == null && String(approval.device_id) === deviceId
        && String(approval.issue_hash) === hashIssue(issue)
        && String(approval.draft_hash) === hashApprovalDraft({ deviceId, issue, summary, sessionId })
        && String(approval.session_id) === sessionId
        && new Date(String(approval.expires_at)).getTime() > Date.now();
      if (!valid) throw new ServiceError('Approval token is invalid, expired, already used, or bound to a different request. Confirm the exact draft again.', 403, 'APPROVAL_INVALID');
      const consumed = await client.query(
        `UPDATE approval_tokens SET consumed_at = NOW() WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW() RETURNING token_hash`,
        [hashToken(input.approvalToken)],
      );
      if (consumed.rowCount !== 1) throw new ServiceError('Approval token has already been consumed. Confirm the draft again.', 403, 'APPROVAL_REPLAY');
      const deviceResult = await client.query('SELECT * FROM devices WHERE id = $1', [deviceId]);
      if (!deviceResult.rows[0]) throw new ServiceError('Device not found.', 404, 'DEVICE_NOT_FOUND');
      const device = mapDevice(deviceResult.rows[0] as Record<string, unknown>);
      const warranty = evaluateWarranty(device.purchaseDate, device.warrantyMonths);
      const severity = detectSeverity(issue);
      const caseId = newId('case');
      const now = new Date().toISOString();
      const rows = await client.query(
        `INSERT INTO repair_cases (id,device_id,issue,status,severity,warranty_state,summary,resolution,created_at,updated_at,approved_at,session_id)
         VALUES ($1,$2,$3,'Draft',$4,$5,$6,$7,$8,$8,$8,$9) RETURNING *`,
        [caseId, deviceId, issue, severity, warranty.state, summary, 'Local draft only. No provider has been contacted and no appointment has been booked.', now, sessionId],
      );
      await client.query(
        `INSERT INTO case_events (id,case_id,kind,title,detail,created_at) VALUES ($1,$2,'approval','Draft approved by user','User explicitly confirmed the exact repair-case draft. No external action was taken.',$3)`,
        [newId('event'), caseId, now],
      );
      return mapCase({ ...(rows.rows[0] as Record<string, unknown>), device_name: device.name });
    });
    await this.writeAudit('case_created', { deviceId, issue, sessionId }, true);
    return result;
  }

  async listCases(): Promise<RepairCase[]> {
    const { rows } = await pool.query(
      `SELECT c.*, d.name AS device_name FROM repair_cases c JOIN devices d ON d.id = c.device_id ORDER BY c.created_at DESC LIMIT 100`,
    );
    return rows.map((row) => mapCase(row as Record<string, unknown>));
  }

  async getCase(id: string): Promise<RepairCase | null> {
    const { rows } = await pool.query(
      `SELECT c.*, d.name AS device_name FROM repair_cases c JOIN devices d ON d.id = c.device_id WHERE c.id = $1`, [id],
    );
    if (!rows[0]) return null;
    const row = rows[0] as Record<string, unknown>;
    const events = await pool.query('SELECT * FROM case_events WHERE case_id = $1 ORDER BY created_at ASC', [id]);
    return { ...mapCase(row), events: events.rows.map((event) => mapEvent(event as Record<string, unknown>)) };
  }

  async addCaseNote(id: string, note: string): Promise<CaseEvent> {
    const cleanNote = normalizeText(note);
    if (cleanNote.length < 2 || cleanNote.length > 1200) throw new ServiceError('Note must be between 2 and 1,200 characters.');
    return withTransaction(async (client) => {
      const found = await client.query('SELECT id FROM repair_cases WHERE id = $1 FOR UPDATE', [id]);
      if (!found.rows[0]) throw new ServiceError('Repair case not found.', 404, 'CASE_NOT_FOUND');
      const now = new Date().toISOString();
      const { rows } = await client.query(
        `INSERT INTO case_events (id,case_id,kind,title,detail,created_at) VALUES ($1,$2,'note','User note',$3,$4) RETURNING *`,
        [newId('event'), id, cleanNote, now],
      );
      await client.query('UPDATE repair_cases SET updated_at = $1 WHERE id = $2', [now, id]);
      return mapEvent(rows[0] as Record<string, unknown>);
    });
  }

  async dashboard(): Promise<DashboardData> {
    const [devices, cases, high, warranty, recent] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM devices'),
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM repair_cases WHERE status IN ('Draft','In progress')`),
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM repair_cases WHERE status IN ('Draft','In progress') AND severity IN ('high','urgent')`),
      pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM devices WHERE warranty_months > 0 AND (purchase_date + (warranty_months || ' months')::interval)::date >= CURRENT_DATE`),
      this.listCases(),
    ]);
    const latestEvents = await pool.query('SELECT * FROM case_events ORDER BY created_at DESC LIMIT 5');
    return {
      devices: Number(devices.rows[0]?.count ?? 0), openCases: Number(cases.rows[0]?.count ?? 0),
      highPriority: Number(high.rows[0]?.count ?? 0), activeWarranty: Number(warranty.rows[0]?.count ?? 0),
      recentCases: recent.slice(0, 5), latestEvents: latestEvents.rows.map((row) => mapEvent(row as Record<string, unknown>)),
    };
  }

  async writeAudit(toolName: string, safeArguments: Record<string, unknown>, success: boolean, errorCode?: string): Promise<void> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(safeArguments)) {
      if (/token|secret|password|authorization|cookie|serial(number)?/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (/(^|_)(issue|prompt|summary|note|excerpt|query|content|message)(_|$)/i.test(key) || /^(issue|prompt|summary|note|excerpt|query|content|message)$/i.test(key)) {
        // Retain useful audit metadata without copying free-form user content into logs.
        sanitized[key] = typeof value === 'string' ? { redacted: true, length: value.length } : '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    try {
      await pool.query(
        'INSERT INTO audit_logs (id,tool_name,arguments_json,success,error_code) VALUES ($1,$2,$3::jsonb,$4,$5)',
        [newId('audit'), toolName, JSON.stringify(sanitized), success, errorCode ?? null],
      );
    } catch {
      // A logging failure must not turn a completed user workflow into a false failure.
    }
  }
}

export const fixRelayService = new FixRelayService();
