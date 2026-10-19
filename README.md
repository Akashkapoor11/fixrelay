# FixRelay - Evidence-Grounded Home Repair Agent

FixRelay helps a household move from an ambiguous device issue to a safer, evidence-backed next step. It brings device context, source-labelled manual excerpts, transparent warranty date arithmetic, illustrative service options, approval-gated local repair cases, and a real MCP interface into one coherent workflow.

> **Truth-in-demo notice:** The bundled product records and manual excerpts are synthetic demonstration data. User-provided excerpts are marked unverified. Warranty status is date arithmetic, not a manufacturer coverage decision. Service options are illustrative. FixRelay does not contact manufacturers, send messages, book appointments, or make purchases.

## Professional technology stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 19, TypeScript, Vite | Component-based, typed browser application and production build |
| Styling | Tailwind CSS 4 + focused custom CSS | Responsive design system and polished interaction states |
| Backend API | Node.js 22+, Express 5, TypeScript | Validated HTTP endpoints, request controls and shared domain service |
| Primary-track integration | Official Model Context Protocol TypeScript SDK v2 packages; Streamable HTTP | MCP server with real tool discovery and execution, compatible with the required 2025-11-25 protocol family |
| AI agent | Strands Agents TypeScript SDK | Agent orchestration and MCP tool access |
| Model | Amazon Bedrock | Optional live model reasoning when AWS access is configured |
| Database | PostgreSQL 16+ with `pg` | Persistent devices, evidence, cases, event history, messages, approvals and audit records |
| Validation | Zod 4 | Request and MCP tool input validation |
| Testing | Vitest, Node test runner, HTTP/MCP integration tests | Domain, transport and workflow coverage |
| Developer tool | MCP Sentinel (TypeScript) | Independent MCP handshake, tool-list and tool-call smoke checks |
| Container / CI | Docker, Docker Compose, GitHub Actions | Repeatable local setup and automated checks |

The TypeScript MCP SDK is used through its split `@modelcontextprotocol/server` and `@modelcontextprotocol/node` packages. The handler supports the legacy initialize-based 2025 protocol behavior needed by the Alexa+ track. The current Strands TypeScript SDK lives in the `strands-agents/harness-sdk` monorepo; the previously archived standalone repository is not the dependency source. See the links in `docs/ARCHITECTURE.md`.


## Repository layout

```text
FixRelay/
├── frontend/                    # React UI, styling, Vite and client TypeScript config
│   ├── index.html
│   └── src/                     # App, browser API client, styles and bootstrap
├── backend/                     # Node.js/Express server-side implementation
│   ├── src/                     # API, MCP server, AI agent, database and domain logic
│   ├── scripts/                 # MCP response parser and AWS verification utility
│   ├── tests/                   # HTTP, service and AWS helper tests
│   ├── aws/agentcore/            # Optional AgentCore deployment guide
│   └── tsconfig*.json
├── open-source/MCP-Sentinel/    # Separate contribution-ready MCP protocol tester
├── docs/                         # Architecture, demo, submission and validation docs
├── package.json                  # Monorepo scripts and dependencies
├── tsconfig.json                 # Shared strict TypeScript defaults
└── vitest.config.ts              # Root test discovery for backend tests
```

The repository is deliberately split by runtime responsibility: **all browser-facing application code lives in `frontend/`, and all API, database, agent, MCP, backend scripts and backend tests live in `backend/`.** Root files are workspace, container, CI and documentation configuration.

## What the app does

- **Investigate:** Match a device from inventory, retrieve relevant labelled excerpts, calculate a date-only warranty window, classify obvious safety hazards, and show recommended next steps.
- **Evidence labels:** Distinguish source-flagged records from synthetic or user-provided content. Never describe demo excerpts as real manufacturer documents.
- **Device inventory:** Add a device and optionally attach a permitted manual excerpt, section, and source URL directly in the UI or API. Excerpts remain unverified; a source URL is provenance, not authentication.
- **Repair cases:** Create a local draft only after a separate explicit UI confirmation and the use of a short-lived, single-use token bound to the device, issue, exact normalized summary and session. The token is hashed at rest and redacted in audit logs.
- **MCP lab:** A browser-side JSON-RPC client negotiates the 2025-11-25 protocol family, discovers tools and invokes the actual `/mcp` endpoint.
- **Evidence trust:** An excerpt is unverified unless its explicit database `verified` flag is set by a future trusted verification workflow; source names/labels never promote user-supplied or synthetic text to verified status. Search uses PostgreSQL full-text ranking and a matching GIN index.
- **AI mode:** `AI_PROVIDER=demo` uses deterministic, transparent behavior without external inference. `AI_PROVIDER=bedrock` uses Strands + Amazon Bedrock and connects the agent to the MCP server. The AWS path must be verified with your own AWS account before it is claimed as live.
- **MCP Sentinel:** Separate TypeScript open-source CLI to probe an MCP endpoint, validate the handshake and basic tool schemas, optionally execute a named tool, and emit a JUnit report.

## Prerequisites

- Node.js 22+ and npm 10+
- Docker Desktop / Docker Engine with Docker Compose (recommended for PostgreSQL)
- Optional: AWS credentials, Bedrock model access in the selected region, and required IAM permissions for live AI testing

The coding environment used to author this archive did not have registry DNS access, so third-party npm packages could not be installed and a generated `package-lock.json` could not be created here. Run `npm install` in a normal network-enabled development environment; commit the generated lockfile before publishing the repository for reproducible installs. The source is strict TypeScript and the CI workflow runs type-check, test and build steps after dependencies can be installed.

## Quick start

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

3. Install packages and start the API + Vite development server:

   ```bash
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173`. The API runs on `http://127.0.0.1:8000` and Vite proxies `/api` and `/mcp` to it.

To build and run the production bundle:

```bash
npm run build
npm start
```

Open `http://127.0.0.1:8000` after production startup. Startup creates PostgreSQL tables and seeds fictional records only when the device inventory is empty.

## Demo workflow

1. On Overview, investigate `PureAir 450` with `The unit is making a grinding noise.`
2. Inspect the safety guidance, evidence excerpt, source note, warranty date calculation and illustrative options.
3. Add a device in **Devices**. Expand **Attach product reference** to add a short permitted excerpt, its section/title, and an optional HTTP(S) URL. Supplied content stays unverified.
4. Explicitly confirm **Create repair-case draft**. The server issues a short-lived token and consumes it exactly once for the matching request.
5. Inspect the case and event timeline in **Repair cases**.
6. Open **MCP lab**, connect via `initialize` → `notifications/initialized` → `tools/list`, then run `search_devices` or `search_manual` against the actual server endpoint.
7. If AWS access has been configured and verified, use `AI_PROVIDER=bedrock` and try the agent panel. Otherwise the interface labels the deterministic mode as Demo mode.

## Commands and tests

```bash
npm run typecheck
npm test
npm run build
npm run test:coverage
```

PostgreSQL integration tests run when `DATABASE_URL` is set and otherwise skip. To exercise the MCP endpoint manually, start the application then run:

```bash
npm run mcp:sentinel -- http://127.0.0.1:8000/mcp
npm run mcp:sentinel -- http://127.0.0.1:8000/mcp --call-tool search_devices --arguments '{"query":"air purifier"}'
```

The independent MCP Sentinel folder can also be published as its own repository. From that folder run `npm install`, `npm test`, and `npm run build`.

## Enable actual Bedrock + Strands

1. Configure AWS credentials via an AWS profile, AWS IAM Identity Center, or an execution role. Never place access keys in browser code or commit them.
2. Ensure the account can invoke the selected model in `AWS_REGION`.
3. Set `AI_PROVIDER=bedrock`, `AWS_REGION`, `BEDROCK_MODEL_ID`, and `MCP_PUBLIC_URL` in the server environment.
4. Restart the Node server and call `/api/agent/chat` from the UI.
5. Run the verification script:

   ```bash
   npm run aws:preflight
   npm run aws:verify
   ```

   The second command calls live services and can incur AWS charges. It requests confirmation unless explicitly overridden. A successful local MCP test alone does **not** prove Bedrock integration is working. Review `docs/VALIDATION_REPORT.md` and the AWS docs before claiming that this path has passed.

### Optional AgentCore deployment

AgentCore Runtime supports TypeScript/Node.js deployment. `backend/aws/agentcore/README.md` documents the official CLI-based path. AgentCore is optional: Bedrock + Strands already provides a meaningful AWS Builder integration if that full path actually works and is documented. Do not claim an AgentCore deployment until it is deployed and invoked from your AWS account.

## Deployment and security boundaries
The API defaults to `127.0.0.1:8000`. Configure the exact public hostname in `ALLOWED_HOSTS` and the allowed browser origins in `ALLOWED_ORIGINS`; wildcard host entries are not supported. The deployment hostname must be explicitly added before exposing the app behind a reverse proxy.


- PostgreSQL is required; this is not an SQLite/local-file application.
- The default bind address is `127.0.0.1`. Only bind to public interfaces behind TLS, authentication, authorization, rate limiting and a security-reviewed proxy.
- The local demo has no user login or per-user tenancy. Do not expose it directly to the public internet with personal or sensitive data.
- The browser and MCP endpoint reject unlisted origins in configured environments. Origin/CORS checks are not a replacement for authentication.
- Approval tokens prevent accidental repeat calls and bind to the matching case request, but they do not provide user identity or authorization on their own.
- Keep synthetic data visibly labelled, and verify any real manual before relying on instructions.

## Project documentation

- `docs/ARCHITECTURE.md` — boundaries and data flow
- `docs/DEMO_SCRIPT.md` — concise judging demo
- `docs/DEVPOST_COPY.md` — public page draft and stack tags
- `docs/DEVPOST_STORY.md` — narrative template
- `docs/SUBMISSION_CHECKLIST.md` — rules-aligned submission checklist
- `docs/PRODUCT_FEEDBACK_TEMPLATE.md` — truthful feedback worksheet
- `docs/VALIDATION_REPORT.md` — verified checks and current gaps
- `docs/FILE_BY_FILE_AUDIT.md` — file inventory, rules matrix and release blockers
- `SECURITY.md` — security boundaries and reporting
- `CONTRIBUTING.md` — local workflow

## License

MIT. See `LICENSE`.

## Latest release verification status — 2026-10-18/19

All core checks have been verified on a live network-enabled environment:

| Check | Status |
|---|---|
| `npm install` | ✅ Completed — `package-lock.json` present |
| `npm run dev` (API + Vite) | ✅ Running — API on :8000, frontend on :5173 |
| `npm run db:init` | ✅ PostgreSQL on Render connected, schema ready, 4 demo devices seeded |
| `GET /api/health` | ✅ `{"status":"ok","database":"connected","aiProvider":"bedrock"}` |
| AWS credentials + preflight | ✅ IAM user `fixrelay-agent`, region `ap-southeast-2`, all preflight checks PASS |
| MCP Sentinel — 47 tests | ✅ 0 failures |
| Investigation workflow (browser) | ✅ HIGH PRIORITY + safety + evidence + warranty — all working |
| Live Bedrock inference | ✅ AWS account verification  |

See [`docs/VALIDATION_REPORT.md`](docs/VALIDATION_REPORT.md) for the full live verification table.

