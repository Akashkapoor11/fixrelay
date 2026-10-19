import 'dotenv/config';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { initializeDatabase, pool } from './db/pool.js';
import { fixRelayService, ServiceError } from './domain/service.js';
import { mcpHandler } from './mcp/server.js';

const PORT = Number(process.env.PORT ?? 8000);
const HOST = process.env.HOST ?? '127.0.0.1';
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000')
  .split(',').map((origin) => origin.trim()).filter(Boolean));

function normalizeHostname(value: string): string | null {
  try {
    const parsed = new URL(`http://${value}`);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return null;
  }
}

const allowedHosts = new Set((process.env.ALLOWED_HOSTS ?? 'localhost,127.0.0.1,[::1]')
  .split(',').map((host) => normalizeHostname(host.trim())).filter((host): host is string => Boolean(host)));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  // The MCP SDK HTTP helper does not validate Host/Origin by itself. Restrict Host
  // before any route, including MCP, to reduce DNS-rebinding and host-header risks.
  app.use((req, res, next) => {
    const hostname = req.get('host') ? normalizeHostname(req.get('host')!) : null;
    if (!hostname || !allowedHosts.has(hostname)) {
      return res.status(403).json({ error: 'Host is not allowed.', code: 'HOST_DENIED' });
    }
    return next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, ...(process.env.NODE_ENV === 'production' ? {} : { contentSecurityPolicy: false }) }));
  app.use(cors({ origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by FixRelay CORS policy.'));
  }, credentials: false, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Mcp-Protocol-Version', 'Mcp-Session-Id', 'Accept'] }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Rate limit reached. Please retry shortly.' } }));

  // Register MCP before express.json so the SDK can process the original request stream.
  app.all('/mcp', toNodeHandler(mcpHandler));
  app.use(express.json({ limit: '1mb', strict: true }));

  app.get('/api/health', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', service: 'fixrelay-api', database: 'connected', aiProvider: process.env.AI_PROVIDER === 'bedrock' ? 'bedrock' : 'demo', mcp: '/mcp', time: new Date().toISOString() });
    } catch (error) { next(error); }
  });

  app.get('/api/config', (_req, res) => {
    res.json({ aiProvider: process.env.AI_PROVIDER === 'bedrock' ? 'bedrock' : 'demo', mcpEndpoint: '/mcp', protocolFamily: 'MCP Streamable HTTP (2025-11-25 compatible)' });
  });

  app.get('/api/overview', async (_req, res, next) => {
    try { res.json(await fixRelayService.dashboard()); } catch (error) { next(error); }
  });

  app.get('/api/devices', async (req, res, next) => {
    try { res.json({ devices: await fixRelayService.listDevices(String(req.query.search ?? '')) }); } catch (error) { next(error); }
  });

  app.get('/api/devices/:id', async (req, res, next) => {
    try {
      const device = await fixRelayService.getDevice(req.params.id);
      if (!device) return res.status(404).json({ error: 'Device not found.', code: 'DEVICE_NOT_FOUND' });
      return res.json({ device });
    } catch (error) { return next(error); }
  });

  app.post('/api/devices', async (req, res, next) => {
    try { res.status(201).json({ device: await fixRelayService.addDevice(req.body) }); } catch (error) { next(error); }
  });

  app.get('/api/evidence', async (req, res, next) => {
    try {
      const query = String(req.query.query ?? '').slice(0, 240);
      const deviceId = req.query.deviceId ? String(req.query.deviceId).slice(0, 160) : undefined;
      res.json({ evidence: await fixRelayService.searchManuals(query, deviceId) });
    } catch (error) { next(error); }
  });

  app.post('/api/investigations', async (req, res, next) => {
    try {
      const result = await fixRelayService.investigate({
        deviceQuery: String(req.body.deviceQuery ?? ''), issue: String(req.body.issue ?? ''),
        ...(req.body.sessionId ? { sessionId: String(req.body.sessionId) } : {}),
      });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/api/approvals', async (req, res, next) => {
    try {
      const result = await fixRelayService.createApproval({ deviceId: String(req.body.deviceId ?? ''), issue: String(req.body.issue ?? ''), summary: String(req.body.summary ?? ''), sessionId: String(req.body.sessionId ?? '') });
      res.status(201).json(result);
    } catch (error) { next(error); }
  });

  app.get('/api/cases', async (_req, res, next) => {
    try { res.json({ cases: await fixRelayService.listCases() }); } catch (error) { next(error); }
  });

  app.get('/api/cases/:id', async (req, res, next) => {
    try {
      const record = await fixRelayService.getCase(req.params.id);
      if (!record) return res.status(404).json({ error: 'Repair case not found.', code: 'CASE_NOT_FOUND' });
      return res.json({ case: record });
    } catch (error) { return next(error); }
  });

  app.post('/api/cases', async (req, res, next) => {
    try {
      const record = await fixRelayService.createCase({
        deviceId: String(req.body.deviceId ?? ''), issue: String(req.body.issue ?? ''),
        summary: String(req.body.summary ?? ''), sessionId: String(req.body.sessionId ?? ''),
        approvalToken: String(req.body.approvalToken ?? ''),
      });
      res.status(201).json({ case: record });
    } catch (error) { next(error); }
  });

  app.post('/api/cases/:id/notes', async (req, res, next) => {
    try { res.status(201).json({ event: await fixRelayService.addCaseNote(req.params.id, String(req.body.note ?? '')) }); } catch (error) { next(error); }
  });

  app.post('/api/agent/chat', async (req, res, next) => {
    try {
      const prompt = String(req.body.prompt ?? '').trim();
      if (prompt.length < 4 || prompt.length > 1600) throw new ServiceError('Prompt must be between 4 and 1,600 characters.');
      const sessionId = String(req.body.sessionId ?? `session_${Date.now()}`);

      // API-first: always attempt the live Bedrock agent when configured.
      // Any failure (credentials, timeout, rate-limit, network) is caught, logged server-side,
      // and execution falls through to the deterministic evidence engine — the user always gets a response.
      if (process.env.AI_PROVIDER === 'bedrock') {
        try {
          const { runBedrockAgent } = await import('./ai/agent.js');
          const result = await runBedrockAgent(prompt, sessionId);
          return res.json(result);
        } catch (bedrockError) {
          console.warn(JSON.stringify({
            level: 'warn',
            message: 'bedrock_agent_failed_falling_back_to_evidence_engine',
            error: bedrockError instanceof Error ? bedrockError.message : String(bedrockError),
          }));
          // Fall through to the evidence engine below.
        }
      }

      // Guaranteed 100% fallback: deterministic evidence-grounded engine — always available.
      const result = await fixRelayService.investigate({ deviceQuery: prompt, issue: prompt, sessionId });
      const evidenceLine = result.evidence[0]
        ? ` Evidence considered: "${result.evidence[0].title}" (${result.evidence[0].verified ? 'verified source flag' : 'unverified/demo source'}).`
        : ' No matching reference excerpt was found.';
      const warrantyLine = result.warranty
        ? ` Recorded warranty dates: ${result.warranty.state}; calculated expiry ${result.warranty.calculatedExpiryDate}.`
        : '';
      return res.json({
        provider: 'demo',
        answer: `${result.safetyGuidance.join(' ')}${evidenceLine}${warrantyLine} ${result.disclaimer}`,
        investigation: result,
      });
    } catch (error) { return next(error); }
  });

  // Return JSON 404 for any unknown /api/* path rather than Express's default HTML "Cannot GET" response.
  // Express 5 + path-to-regexp v8 require a named wildcard parameter — /api/* is invalid, /api/*path is correct.
  app.all('/api/*path', (_req, res) => {
    res.status(404).json({ error: 'API route not found.', code: 'NOT_FOUND' });
  });

  const clientDist = resolve(process.cwd(), 'dist/client');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/mcp') return next();
      return res.sendFile(resolve(clientDist, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (error: unknown, _req: Request, res: Response, _next) => {
    if (res.headersSent) return;
    if (error instanceof ServiceError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0]?.message ?? 'Request validation failed.', code: 'VALIDATION_ERROR' });
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    if (message.includes('Origin is not allowed')) return res.status(403).json({ error: 'Origin is not allowed.', code: 'ORIGIN_DENIED' });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Request body is not valid JSON.', code: 'INVALID_JSON' });
    // Do not expose stack traces, connection strings or provider errors to the browser.
    console.error(JSON.stringify({ level: 'error', message: 'request_failed', errorType: error instanceof Error ? error.name : 'Unknown' }));
    return res.status(500).json({ error: 'Unexpected server error. Check server logs for the request identifier.', code: 'INTERNAL_ERROR' });
  };
  app.use(errorHandler);
  return app;
}

async function main() {
  if (!process.env.DATABASE_URL) console.warn('DATABASE_URL is not set; using the local Docker Compose default.');
  await initializeDatabase();
  const app = createApp();
  const server = app.listen(PORT, HOST, () => console.info(JSON.stringify({ level: 'info', message: 'fixrelay_started', host: HOST, port: PORT, aiProvider: process.env.AI_PROVIDER === 'bedrock' ? 'bedrock' : 'demo' })));
  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((error) => {
    console.error(JSON.stringify({ level: 'fatal', message: error instanceof Error ? error.message : 'Startup failed' }));
    process.exit(1);
  });
}
